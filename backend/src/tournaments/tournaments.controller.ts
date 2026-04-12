import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards";
import { TournamentsService } from "./tournaments.service";

@ApiTags("tournaments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("tournaments")
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  @ApiOperation({ summary: "List all tournaments" })
  findAll() {
    return this.tournamentsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get tournament detail (rounds + nominations)" })
  findOne(@Param("id") id: string) {
    return this.tournamentsService.findOne(id);
  }

  @Get(":id/leaderboard")
  @ApiOperation({ summary: "Tournament leaderboard sorted by score" })
  leaderboard(@Param("id") id: string) {
    return this.tournamentsService.getLeaderboard(id);
  }

  @Get(":id/nominations")
  @ApiOperation({ summary: "Nominations with vote counts" })
  nominations(@Param("id") id: string) {
    return this.tournamentsService.getNominations(id);
  }

  @Get(":id/me")
  @ApiOperation({ summary: "My participation in a tournament" })
  me(@Param("id") id: string, @Req() req: any) {
    return this.tournamentsService.getMyParticipation(id, req.user.userId);
  }

  @Post(":id/vote/:nominationId")
  @HttpCode(200)
  @ApiOperation({ summary: "Vote for a nominated market (max 3 per tournament)" })
  vote(
    @Param("id") id: string,
    @Param("nominationId") nominationId: string,
    @Req() req: any,
  ) {
    return this.tournamentsService.vote(id, nominationId, req.user.userId);
  }

  @Post(":id/register")
  @HttpCode(200)
  @ApiOperation({ summary: "Register for a tournament" })
  register(@Param("id") id: string, @Req() req: any) {
    return this.tournamentsService.register(id, req.user.userId);
  }
}
