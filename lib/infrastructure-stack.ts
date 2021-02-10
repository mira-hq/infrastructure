import { Construct, Stack, StackProps } from "monocdk";
import { Bucket } from "monocdk/aws-s3";

export class InfrastructureStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new Bucket(this, "MyFirstBucket", {
      versioned: true,
    });
  }
}
