import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { Dispute } from "../entities/dispute.entity";
import { JwtAuthGuard, Public, AdminGuard } from "../auth/guards";
import {
  MarketsService,
  PlaceBetDto,
  UpdateMarketDto,
  SubmitDisputeDto,
} from "./markets.service";

@ApiTags("markets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("markets")
export class MarketsController {
  constructor(private marketsService: MarketsService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: "List all markets, optionally filtered by search query",
  })
  @ApiQuery({
    name: "q",
    required: false,
    description: "Search term to filter markets by title or description",
  })
  findAll(@Query("q") q?: string) {
    return this.marketsService.findAll(q);
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
  placeBet(@Param("id") id: string, @Body() dto: PlaceBetDto, @Request() req: any) {
    return this.marketsService.placeBet(req.user.userId, id, dto);
  }

  @Get(":id/disputes")
  @Public()
  @ApiOperation({ summary: "Get disputes for a market" })
  @ApiResponse({ status: 200, type: [Dispute] })
  getDisputes(@Param("id") id: string) {
    return this.marketsService.getDisputesByMarket(id);
  }

  @Post(":id/disputes")
  @ApiOperation({
    summary: "Submit a dispute bond during the 24h resolution window",
  })
  @ApiResponse({ status: 201, type: Dispute })
  submitDispute(
    @Param("id") id: string,
    @Body() dto: SubmitDisputeDto,
    @Request() req: any,
  ) {
    return this.marketsService.submitDispute(req.user.userId, id, dto);
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
