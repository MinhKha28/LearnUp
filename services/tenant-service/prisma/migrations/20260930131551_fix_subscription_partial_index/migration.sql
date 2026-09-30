/*
  Warnings:

  - A unique constraint covering the columns `[organization_id]` on the table `subscriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "subscriptions_one_current_per_org_key";

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_one_current_per_org_key" ON "subscriptions"("organization_id") WHERE (status = 'Active' OR status = 'Grace' OR status = 'Suspended');
