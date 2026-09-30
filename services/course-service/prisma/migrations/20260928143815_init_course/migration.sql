-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "trainingObjective" TEXT,
    "estimatedCompletionDays" INTEGER,
    "estimatedDurationMinutes" INTEGER,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "rootCourseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);
