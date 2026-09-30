CREATE TYPE "NearbyChannel" AS ENUM ('CONFESSION', 'TREEHOLE');

CREATE TABLE "nearby_presences" (
  "id" TEXT NOT NULL,
  "identity_id" TEXT NOT NULL,
  "channel" "NearbyChannel" NOT NULL,
  "longitude" DECIMAL(10,6) NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "located_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "nearby_presences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nearby_presences_identity_id_channel_key"
  ON "nearby_presences"("identity_id", "channel");
CREATE INDEX "nearby_presences_channel_located_at_idx"
  ON "nearby_presences"("channel", "located_at");
CREATE INDEX "nearby_presences_channel_latitude_longitude_idx"
  ON "nearby_presences"("channel", "latitude", "longitude");
