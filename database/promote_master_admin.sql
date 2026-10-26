-- Run against your existing database to bootstrap the first master admin.
-- Replace NULL with the email of the existing account you want to promote.
-- Leaving NULL makes this script a no-op. Log in again after promotion.
SET @master_admin_email = NULL;

UPDATE `User` u
INNER JOIN Member m ON m.MemberID = u.MemberID
SET u.Role = 'master_admin'
WHERE m.Email = @master_admin_email;
