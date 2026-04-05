import { ApiProperty } from "@nestjs/swagger";
import { IsUUID, IsNumber, Min } from "class-validator";

export class PlaceBetDto {
  @ApiProperty() @IsUUID() outcomeId: string;
  @ApiProperty() @IsNumber() @Min(1) amount: number;
}
