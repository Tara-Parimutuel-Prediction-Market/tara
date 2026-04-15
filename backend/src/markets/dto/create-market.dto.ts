import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsArray,
  Min,
  Max,
} from "class-validator";
import { Transform } from "class-transformer";

export class CreateMarketDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrlAlt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resolutionCriteria?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() opensAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() closesAt?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  houseEdgePct?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(100)
  liquidityParam?: number;

  @ApiProperty({
    type: [String],
    description: 'Outcome labels e.g. ["Team A wins","Draw","Team B wins"]',
  })
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    // If outcomes is an array of objects with a 'label' property, extract the labels
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === "object" &&
      value[0].label
    ) {
      return value.map((item: any) => item.label);
    }
    // Otherwise, return as-is (should be array of strings)
    return value;
  })
  outcomes: string[];

  /** football-data.org match ID — set when creating a market from a fixture */
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  externalMatchId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalSource?: string;

  /** "match-winner" | "over-under" — used by the keeper to auto-propose results */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalMarketType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;
}
