import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTournamentsAndConfidenceScore1775980000001
  implements MigrationInterface
{
  name = "AddTournamentsAndConfidenceScore1775980000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. positions: poolPctAtBet ─────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "positions"
        ADD COLUMN IF NOT EXISTS "poolPctAtBet" numeric(10,6) NULL
    `);

    // ── 2. markets: external fixture fields ───────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "markets"
        ADD COLUMN IF NOT EXISTS "externalMatchId"     integer      NULL,
        ADD COLUMN IF NOT EXISTS "externalSource"      varchar(64)  NULL,
        ADD COLUMN IF NOT EXISTS "externalMarketType"  varchar(32)  NULL
    `);

    // ── 3. tournaments ─────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."tournaments_status_enum"
          AS ENUM('nominations','registration','active','completed','cancelled');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tournaments" (
        "id"                   uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "name"                 varchar     NOT NULL,
        "description"          text        NULL,
        "status"               "public"."tournaments_status_enum"
                                           NOT NULL DEFAULT 'nominations',
        "maxParticipants"      integer     NOT NULL DEFAULT 16,
        "nominationDeadline"   TIMESTAMP WITH TIME ZONE NOT NULL,
        "registrationDeadline" TIMESTAMP WITH TIME ZONE NOT NULL,
        "winnerId"             uuid        NULL,
        "createdAt"            TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournaments" PRIMARY KEY ("id")
      )
    `);

    // ── 4. tournament_rounds ───────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."tournament_rounds_status_enum"
          AS ENUM('pending','open','scoring','completed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tournament_rounds" (
        "id"           uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "tournamentId" uuid        NOT NULL,
        "roundNumber"  integer     NOT NULL,
        "roundLabel"   varchar(32) NOT NULL,
        "marketId"     uuid        NULL,
        "status"       "public"."tournament_rounds_status_enum"
                                   NOT NULL DEFAULT 'pending',
        "opensAt"      TIMESTAMP WITH TIME ZONE NULL,
        "closesAt"     TIMESTAMP WITH TIME ZONE NULL,
        CONSTRAINT "PK_tournament_rounds" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tournament_rounds_tournamentId'
        ) THEN
          ALTER TABLE "tournament_rounds"
            ADD CONSTRAINT "FK_tournament_rounds_tournamentId"
            FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tournament_rounds_marketId'
        ) THEN
          ALTER TABLE "tournament_rounds"
            ADD CONSTRAINT "FK_tournament_rounds_marketId"
            FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE SET NULL;
        END IF;
      END $$
    `);

    // ── 5. tournament_participants ─────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."tournament_participants_status_enum"
          AS ENUM('active','eliminated','winner');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tournament_participants" (
        "id"                   uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "tournamentId"         uuid        NOT NULL,
        "userId"               uuid        NOT NULL,
        "status"               "public"."tournament_participants_status_enum"
                                           NOT NULL DEFAULT 'active',
        "currentRound"         integer     NOT NULL DEFAULT 1,
        "totalConfidenceScore" numeric(10,6) NOT NULL DEFAULT 0,
        "correctPredictions"   integer     NOT NULL DEFAULT 0,
        "registeredAt"         TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tournament_participants" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tournament_participants_tournament_user"
          UNIQUE ("tournamentId", "userId")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tournament_participants_tournamentId'
        ) THEN
          ALTER TABLE "tournament_participants"
            ADD CONSTRAINT "FK_tournament_participants_tournamentId"
            FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tournament_participants_userId'
        ) THEN
          ALTER TABLE "tournament_participants"
            ADD CONSTRAINT "FK_tournament_participants_userId"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);

    // ── 6. tournament_nominations ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tournament_nominations" (
        "id"           uuid    NOT NULL DEFAULT uuid_generate_v4(),
        "tournamentId" uuid    NOT NULL,
        "marketId"     uuid    NOT NULL,
        "targetRound"  integer NOT NULL DEFAULT 1,
        "voteCount"    integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_tournament_nominations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tournament_nominations_tournament_market"
          UNIQUE ("tournamentId", "marketId")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tournament_nominations_tournamentId'
        ) THEN
          ALTER TABLE "tournament_nominations"
            ADD CONSTRAINT "FK_tournament_nominations_tournamentId"
            FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tournament_nominations_marketId'
        ) THEN
          ALTER TABLE "tournament_nominations"
            ADD CONSTRAINT "FK_tournament_nominations_marketId"
            FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);

    // ── 7. nomination_votes ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nomination_votes" (
        "id"           uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "nominationId" uuid      NOT NULL,
        "userId"       uuid      NOT NULL,
        "createdAt"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_nomination_votes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_nomination_votes_nomination_user"
          UNIQUE ("nominationId", "userId")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_nomination_votes_nominationId'
        ) THEN
          ALTER TABLE "nomination_votes"
            ADD CONSTRAINT "FK_nomination_votes_nominationId"
            FOREIGN KEY ("nominationId")
            REFERENCES "tournament_nominations"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_nomination_votes_userId'
        ) THEN
          ALTER TABLE "nomination_votes"
            ADD CONSTRAINT "FK_nomination_votes_userId"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "nomination_votes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tournament_nominations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tournament_participants"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."tournament_participants_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tournament_rounds"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."tournament_rounds_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tournaments"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."tournaments_status_enum"`);
    await queryRunner.query(`ALTER TABLE "markets" DROP COLUMN IF EXISTS "externalMarketType"`);
    await queryRunner.query(`ALTER TABLE "markets" DROP COLUMN IF EXISTS "externalSource"`);
    await queryRunner.query(`ALTER TABLE "markets" DROP COLUMN IF EXISTS "externalMatchId"`);
    await queryRunner.query(`ALTER TABLE "positions" DROP COLUMN IF EXISTS "poolPctAtBet"`);
  }
}
