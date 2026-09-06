-- CreateEnum
CREATE TYPE "NotificationMode" AS ENUM ('ALL', 'MENTIONS_ONLY', 'WORK_ACTIVITY_ONLY', 'MUTE_ALL');

-- CreateEnum
CREATE TYPE "AppLanguage" AS ENUM ('ENGLISH', 'KURDISH');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "language" "AppLanguage" NOT NULL DEFAULT 'ENGLISH',
ADD COLUMN     "notificationMode" "NotificationMode" NOT NULL DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "language" "AppLanguage" NOT NULL DEFAULT 'ENGLISH',
ADD COLUMN     "notificationMode" "NotificationMode" NOT NULL DEFAULT 'ALL';
