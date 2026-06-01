-- CreateTable: MockQuiz
CREATE TABLE "MockQuiz" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "questionImageKey" TEXT,
    "questionImageName" TEXT,
    "answerImageKey" TEXT,
    "answerImageName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MockExam
CREATE TABLE "MockExam" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "questionImageKey" TEXT,
    "questionImageName" TEXT,
    "answerImageKey" TEXT,
    "answerImageName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockExam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MockQuiz_quizId_ownerId_key" ON "MockQuiz"("quizId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "MockExam_courseId_kind_ownerId_key" ON "MockExam"("courseId", "kind", "ownerId");

-- CreateIndex
CREATE INDEX "MockExam_courseId_kind_idx" ON "MockExam"("courseId", "kind");

-- AddForeignKey
ALTER TABLE "MockQuiz" ADD CONSTRAINT "MockQuiz_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockQuiz" ADD CONSTRAINT "MockQuiz_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
