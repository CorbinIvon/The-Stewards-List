-- CreateTable
CREATE TABLE "universal_chats" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "posterId" TEXT NOT NULL,
    "associativeKey" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "universal_chats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "universal_chats_associativeKey_idx" ON "universal_chats"("associativeKey");

-- CreateIndex
CREATE INDEX "universal_chats_posterId_idx" ON "universal_chats"("posterId");

-- CreateIndex
CREATE INDEX "universal_chats_createdAt_idx" ON "universal_chats"("createdAt");

-- AddForeignKey
ALTER TABLE "universal_chats" ADD CONSTRAINT "universal_chats_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
