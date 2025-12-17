UPDATE mysql.user SET authentication_string=PASSWORD('Hksd2025!@#') WHERE User='root';
UPDATE mysql.user SET password_expired='N' WHERE User='root';
FLUSH PRIVILEGES;
