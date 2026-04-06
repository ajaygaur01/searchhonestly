/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Source" AS ENUM ('REDDIT', 'YOUTUBE', 'SUBSTACK', 'BLOG');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "RawScrape" (
    "id" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "externalId" TEXT NOT NULL,
    "rawContent" JSONB NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawScrape_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedInsight" (
    "id" TEXT NOT NULL,
    "rawScrapeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyPoints" JSONB NOT NULL,
    "relevanceScore" INTEGER NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RawScrape_externalId_key" ON "RawScrape"("externalId");

-- CreateIndex
CREATE INDEX "RawScrape_source_status_idx" ON "RawScrape"("source", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedInsight_rawScrapeId_key" ON "ProcessedInsight"("rawScrapeId");

-- AddForeignKey
ALTER TABLE "ProcessedInsight" ADD CONSTRAINT "ProcessedInsight_rawScrapeId_fkey" FOREIGN KEY ("rawScrapeId") REFERENCES "RawScrape"("id") ON DELETE CASCADE ON UPDATE CASCADE;
