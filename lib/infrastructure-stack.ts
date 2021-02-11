import { Construct, Duration, Stack, StackProps } from "monocdk";
import { BlockPublicAccess, Bucket } from "monocdk/aws-s3";
import { Effect, ManagedPolicy, PolicyStatement, User } from "monocdk/aws-iam";
import {
  CacheCookieBehavior,
  CacheHeaderBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  Distribution,
  HttpVersion,
  OriginAccessIdentity,
  ViewerProtocolPolicy
} from "monocdk/aws-cloudfront";
import { ARecord, HostedZone, RecordTarget } from "monocdk/aws-route53";
import {
  Certificate,
  CertificateValidation
} from "monocdk/aws-certificatemanager";
import { S3Origin } from "monocdk/aws-cloudfront-origins";
import { CloudFrontTarget } from "monocdk/aws-route53-targets";

export class InfrastructureStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // What IAM permissions are needed to use CDK Deploy?
    // https://stackoverflow.com/questions/57118082/what-iam-permissions-are-needed-to-use-cdk-deploy
    const policy = new ManagedPolicy(this, "CdkDeploymentPolicy", {
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: ["*"],
          actions: ["cloudformation:*"]
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: ["*"],
          actions: ["*"],
          conditions: {
            "ForAnyValue:StringEquals": {
              "aws:CalledVia": ["cloudformation.amazonaws.com"]
            }
          }
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: ["arn:aws:s3:::cdktoolkit-stagingbucket-*"],
          actions: ["s3:*"]
        })
      ]
    });

    new User(this, "CdkDeploymentUser", {
      userName: "CdkDeploymentUser",
      managedPolicies: [policy]
    });

    const blockPublicAccess = new BlockPublicAccess({
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true
    });

    const bucket = new Bucket(this, "FrontEndBucket", {
      versioned: true,
      blockPublicAccess
    });

    const comment = "mira-hq-frontend";
    const identity = new OriginAccessIdentity(this, "OriginAccessIdentity", {
      comment
    });

    bucket.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [identity.grantPrincipal],
        actions: ["s3:GetObject"],
        resources: [bucket.bucketArn + "/*"]
      })
    );

    const domainName = "mira-hq.com";

    const hostedZone = new HostedZone(this, "HostedZone", {
      zoneName: domainName
    });

    const certificate = new Certificate(this, "Certificate", {
      domainName,
      subjectAlternativeNames: ["*." + domainName],
      validation: CertificateValidation.fromDns(hostedZone)
    });

    const cachePolicy = new CachePolicy(this, "CachePolicy", {
      defaultTtl: Duration.minutes(5),
      cookieBehavior: CacheCookieBehavior.none(),
      headerBehavior: CacheHeaderBehavior.none(),
      queryStringBehavior: CacheQueryStringBehavior.none()
    });

    const distribution = new Distribution(this, "Distribution", {
      domainNames: [domainName],
      comment,
      defaultBehavior: {
        origin: new S3Origin(bucket, {
          originAccessIdentity: identity
        }),
        compress: true,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cachePolicy
      },
      defaultRootObject: "index.html",
      enableIpv6: true,
      httpVersion: HttpVersion.HTTP2,
      certificate,
      enabled: true,
      errorResponses: [
        {
          ttl: Duration.minutes(5),
          responsePagePath: "/index.html",
          responseHttpStatus: 200,
          httpStatus: 404
        },
        {
          ttl: Duration.minutes(5),
          responsePagePath: "/index.html",
          responseHttpStatus: 200,
          httpStatus: 403
        }
      ]
    });

    new ARecord(this, "RecordSet", {
      zone: hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution))
    });

    const s3Policy = new ManagedPolicy(this, "S3DeploymentPolicy", {
      statements: [

        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [
            bucket.bucketArn,
            bucket.bucketArn + "/*"
          ],
          actions: ["s3:*"]
        })
      ]
    });

    new User(this, "S3DeploymentUser", {
      userName: "S3DeploymentUser",
      managedPolicies: [s3Policy]
    });
  }
}
