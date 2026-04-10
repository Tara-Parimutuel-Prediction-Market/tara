import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  Query,
  UnauthorizedException,
  UseGuards,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { createHmac, timingSafeEqual } from "crypto";
import { AuthService } from "./auth.service";
import { Public, JwtAuthGuard } from "./guards";
import { TelegramAuthDto } from "./dto/telegram-auth.dto";
import { DKBankAuthDto } from "./dto/dkbank-auth.dto";
import { ManualLoginRequestDto } from "./dto/manual-login-request.dto";
import { ManualLoginVerifyDto } from "./dto/manual-login-verify.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("telegram")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: "Login/register with Telegram initData (HMAC validated)",
  })
  async telegramLogin(@Body() dto: TelegramAuthDto) {
    return this.authService.loginWithTelegram(dto.initData);
  }

  @Post("dkbank")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: "Login or register with DK Bank CID (no JWT required)",
  })
  @ApiBody({ type: DKBankAuthDto })
  async dkBankLogin(@Body() dto: DKBankAuthDto, @Request() req: any) {
    // If the caller already carries a valid JWT, treat this as an authenticated
    // link request so we merge into the existing row rather than create a duplicate.
    const callerUserId: string | undefined = req.user?.userId;
    return this.authService.loginWithDKBank(dto.cid, callerUserId);
  }

  /**
   * Called from the TMA when an already-authenticated Telegram user links their DK Bank CID.
   * Writes dkPhoneHash + DK fields onto the existing Telegram user row so phone
   * verification can proceed without creating a duplicate account.
   */
  @Post("link-dkbank")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Link DK Bank CID to the currently authenticated Telegram user (TMA use)",
  })
  @ApiBody({ type: DKBankAuthDto })
  async linkDKBank(@Body() dto: DKBankAuthDto, @Request() req: any) {
    return this.authService.loginWithDKBank(dto.cid, req.user.userId);
  }

  /**
   * DEV ONLY — generates a valid signed initData for any Telegram user ID.
   * Remove or guard this endpoint before going to production.
   */
  @Get("dev/mock-init-data")
  @Public()
  @ApiOperation({
    summary: "[DEV] Generate a valid signed initData for testing",
  })
  @ApiQuery({
    name: "id",
    required: false,
    description: "Telegram user ID (default: 123456789)",
  })
  @ApiQuery({ name: "username", required: false })
  @ApiQuery({ name: "first_name", required: false })
  devMockInitData(
    @Query("id") id = "123456789",
    @Query("username") username = "testuser",
    @Query("first_name") first_name = "Test",
  ) {
    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("Not available in production");
    }
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const user = JSON.stringify({ id: Number(id), first_name, username });
    const auth_date = Math.floor(Date.now() / 1000);

    const params = new URLSearchParams({
      user,
      auth_date: String(auth_date),
      query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    });

    // Sort and build data-check string
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = createHmac("sha256", "WebAppData")
      .update(botToken || "")
      .digest();
    const hash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    // Signature is required by newer TMA SDK versions (Ed25519 in prod, any string in dev)
    const signature = createHmac("sha256", secretKey)
      .update("mock-signature-dev")
      .digest("hex");

    params.set("hash", hash);
    params.set("signature", signature);
    const initData = params.toString();

    return {
      initData,
      usage: `POST /auth/telegram  body: { "initData": "<value above>" }`,
    };
  }

  /**
   * DEV ONLY — one-shot admin token endpoint.
   * Generates signed initData for your real Telegram ID and returns a JWT directly.
   * Protected by a secret from .env (ADMIN_DEV_SECRET).
   */
  @Get("dev/admin-token")
  @Public()
  @ApiOperation({ summary: "[DEV] Get admin JWT in one request" })
  @ApiQuery({
    name: "secret",
    required: true,
    description: "Value of ADMIN_DEV_SECRET in .env",
  })
  async devAdminToken(@Query("secret") secret: string) {
    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("Not available in production");
    }
    const expected = process.env.ADMIN_DEV_SECRET;
    if (!expected) {
      throw new UnauthorizedException("Dev endpoint disabled — ADMIN_DEV_SECRET not set");
    }
    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(secret || "");
    const match =
      expectedBuf.length === receivedBuf.length &&
      timingSafeEqual(expectedBuf, receivedBuf);
    if (!match) {
      throw new UnauthorizedException("Wrong secret");
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
    if (!adminTelegramId) {
      throw new UnauthorizedException("ADMIN_TELEGRAM_ID not set in .env");
    }

    // Build signed initData for the admin Telegram ID
    const user = JSON.stringify({
      id: Number(adminTelegramId),
      first_name: "Admin",
    });
    const auth_date = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams({
      user,
      auth_date: String(auth_date),
      query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    });

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = createHmac("sha256", "WebAppData")
      .update(botToken || "")
      .digest();
    const hash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");
    params.set("hash", hash);

    const result = await this.authService.ensureAdminAndLogin(params.toString());
    return {
      token: result.token,
      user: result.user,
      note: "This token is valid for 8 hours. Keep it secret!",
    };
  }

  /**
   * Manual Login Step 1: Request OTP
   * Fallback when Telegram initData login fails
   * Sends a 6-digit OTP to the user's Telegram ID
   */
  @Post("manual-login/request-otp")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: "Request OTP for manual login (fallback when Telegram initData fails)",
    description: "Sends a 6-digit OTP to the user's Telegram ID via bot. The user must provide their Telegram ID and DK Bank CID.",
  })
  @ApiBody({ type: ManualLoginRequestDto })
  async requestManualLoginOtp(@Body() dto: ManualLoginRequestDto) {
    await this.authService.requestManualLoginOtp(dto.telegramId, dto.cid);
    return {
      success: true,
      message: "OTP sent to your Telegram account. Valid for 5 minutes.",
    };
  }

  /**
   * Manual Login Step 2: Verify OTP and Login
   * Verifies the OTP and checks that the phone number matches DK Bank
   */
  @Post("manual-login/verify")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: "Verify OTP and complete manual login",
    description: "Validates the OTP and phone number. The phone number must match the DK Bank registered number. Returns a JWT token on success.",
  })
  @ApiBody({ type: ManualLoginVerifyDto })
  async verifyManualLogin(@Body() dto: ManualLoginVerifyDto) {
    return this.authService.verifyManualLogin(
      dto.telegramId,
      dto.cid,
      dto.otp,
      dto.phoneNumber,
    );
  }
}
