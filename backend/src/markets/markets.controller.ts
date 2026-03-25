import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard, Public, AdminGuard } from "../auth/guards";
import { MarketsService, PlaceBetDto, UpdateMarketDto } from "./markets.service";

@ApiTags("markets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("markets")
export class MarketsController {
  constructor(private marketsService: MarketsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: "List all markets" })
  findAll() {
    return this.marketsService.findAll();
  }

  @Get(":id")
  @Public()
  @ApiOperation({ summary: "Get market by ID with outcomes & live odds" })
  findOne(@Param("id") id: string) {
    return this.marketsService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: "Update market metadata (admin)" })
  update(@Param("id") id: string, @Body() dto: UpdateMarketDto) {
    return this.marketsService.update(id, dto);
  }

  @Post(":id/bets")
  @ApiOperation({ summary: "Place a bet on a market outcome" })
  placeBet(@Param("id") id: string, @Body() dto: PlaceBetDto, @Request() req) {
    return this.marketsService.placeBet(req.user.userId, id, dto);
  }

  @Post(":id/bets/wallet")
  @Public()
  @ApiOperation({ summary: "Place a bet using TON wallet (no login required)" })
  async placeBetWithWallet(
    @Param("id") id: string,
    @Body()
    dto: {
      outcomeId: string;
      amount: number;
      maxShares?: number;
      limitPrice?: number;
      walletAddress: string;
      txHash?: string;
    },
  ) {
    // TODO: Verify TON transaction on-chain before accepting bet
    return {
      message:
        "Wallet betting endpoint - TODO: implement on-chain verification",
      dto,
    };
  }
}
