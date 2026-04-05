import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class ProposeResolutionDto {
  @ApiProperty({ description: "UUID of the proposed winning outcome" })
  @IsUUID()
  proposedOutcomeId: string;
}
