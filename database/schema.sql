-- Leads Client Hub (CRM) - SQL Server schema.
-- Applied automatically when the app first connects (src/server/db.server.ts), after creating
-- the database if needed. Safe to re-run: every object is created only if it does not exist.
-- Separate batches with a line containing only GO. To apply by hand:
--   sqlcmd -S <server> -U <user> -P <password> -d new_leads_clienthub -i database/schema.sql

SET NOCOUNT ON;

-- Accounts. role: admin (can add/edit/delete) or user (view only).
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
CREATE TABLE dbo.users (
  id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_users PRIMARY KEY DEFAULT NEWID(),
  email         NVARCHAR(320)    NOT NULL CONSTRAINT uq_users_email UNIQUE,
  full_name     NVARCHAR(200)    NOT NULL CONSTRAINT df_users_full_name DEFAULT N'',
  password_hash NVARCHAR(256)    NOT NULL,
  role          NVARCHAR(10)     NOT NULL CONSTRAINT df_users_role DEFAULT N'user'
    CONSTRAINT ck_users_role CHECK (role IN (N'admin', N'user')),
  created_at    DATETIME2(3)     NOT NULL CONSTRAINT df_users_created_at DEFAULT SYSUTCDATETIME()
);

-- Login sessions. token_hash is the SHA-256 of the random token kept in the browser cookie.
IF OBJECT_ID(N'dbo.sessions', N'U') IS NULL
CREATE TABLE dbo.sessions (
  token_hash CHAR(64)         NOT NULL CONSTRAINT pk_sessions PRIMARY KEY,
  user_id    UNIQUEIDENTIFIER NOT NULL
    CONSTRAINT fk_sessions_user REFERENCES dbo.users(id) ON DELETE CASCADE,
  expires_at DATETIME2(3)     NOT NULL,
  created_at DATETIME2(3)     NOT NULL CONSTRAINT df_sessions_created_at DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_sessions_user_id')
  CREATE INDEX ix_sessions_user_id ON dbo.sessions(user_id);

-- departments holds a JSON array of department names, e.g. ["Operations","Training"].
IF OBJECT_ID(N'dbo.clients', N'U') IS NULL
CREATE TABLE dbo.clients (
  id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_clients PRIMARY KEY DEFAULT NEWID(),
  company      NVARCHAR(300)    NOT NULL,
  industry     NVARCHAR(300)    NOT NULL CONSTRAINT df_clients_industry DEFAULT N'',
  location     NVARCHAR(300)    NOT NULL CONSTRAINT df_clients_location DEFAULT N'',
  website      NVARCHAR(500)    NOT NULL CONSTRAINT df_clients_website DEFAULT N'',
  type         NVARCHAR(100)    NOT NULL CONSTRAINT df_clients_type DEFAULT N'',
  departments  NVARCHAR(MAX)    NOT NULL CONSTRAINT df_clients_departments DEFAULT N'[]'
    CONSTRAINT ck_clients_departments CHECK (ISJSON(departments) = 1),
  talent       NVARCHAR(MAX)    NOT NULL CONSTRAINT df_clients_talent DEFAULT N'',
  relationship NVARCHAR(50)     NOT NULL CONSTRAINT df_clients_relationship DEFAULT N'',
  blocked      BIT              NOT NULL CONSTRAINT df_clients_blocked DEFAULT 0,
  block_reason NVARCHAR(MAX)    NULL,
  blocked_on   DATE             NULL,
  last_contact DATE             NULL,
  notes        NVARCHAR(MAX)    NOT NULL CONSTRAINT df_clients_notes DEFAULT N'',
  created_at   DATETIME2(3)     NOT NULL CONSTRAINT df_clients_created_at DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.contacts', N'U') IS NULL
CREATE TABLE dbo.contacts (
  id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_contacts PRIMARY KEY DEFAULT NEWID(),
  client_id    UNIQUEIDENTIFIER NOT NULL
    CONSTRAINT fk_contacts_client REFERENCES dbo.clients(id) ON DELETE CASCADE,
  name         NVARCHAR(200)    NOT NULL CONSTRAINT df_contacts_name DEFAULT N'',
  designation  NVARCHAR(200)    NOT NULL CONSTRAINT df_contacts_designation DEFAULT N'',
  nationality  NVARCHAR(100)    NOT NULL CONSTRAINT df_contacts_nationality DEFAULT N'',
  dob          DATE             NULL,
  race         NVARCHAR(100)    NOT NULL CONSTRAINT df_contacts_race DEFAULT N'',
  gender       NVARCHAR(50)     NOT NULL CONSTRAINT df_contacts_gender DEFAULT N'',
  religion     NVARCHAR(100)    NOT NULL CONSTRAINT df_contacts_religion DEFAULT N'',
  phone        NVARCHAR(100)    NOT NULL CONSTRAINT df_contacts_phone DEFAULT N'',
  email        NVARCHAR(320)    NOT NULL CONSTRAINT df_contacts_email DEFAULT N'',
  reminder     DATE             NULL,
  notes        NVARCHAR(MAX)    NOT NULL CONSTRAINT df_contacts_notes DEFAULT N'',
  talent       NVARCHAR(MAX)    NOT NULL CONSTRAINT df_contacts_talent DEFAULT N'',
  relationship NVARCHAR(50)     NOT NULL CONSTRAINT df_contacts_relationship DEFAULT N'',
  created_at   DATETIME2(3)     NOT NULL CONSTRAINT df_contacts_created_at DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_contacts_client_id')
  CREATE INDEX ix_contacts_client_id ON dbo.contacts(client_id);

-- Values for the drop-down lists (category: types, departments, nationalities, religions).
IF OBJECT_ID(N'dbo.master_options', N'U') IS NULL
CREATE TABLE dbo.master_options (
  id       UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_master_options PRIMARY KEY DEFAULT NEWID(),
  category NVARCHAR(50)     NOT NULL,
  value    NVARCHAR(200)    NOT NULL,
  CONSTRAINT uq_master_options UNIQUE (category, value)
);
GO

-- Starting data from the original system, added once to an empty database.
IF NOT EXISTS (SELECT 1 FROM dbo.master_options) AND NOT EXISTS (SELECT 1 FROM dbo.clients)
BEGIN
  INSERT INTO dbo.master_options (category, value) VALUES
    (N'types', N'Lead'), (N'types', N'Contacted'), (N'types', N'Existing Client'), (N'types', N'Potential Contact'), (N'types', N'Bad Lead'),
    (N'departments', N'Operations'), (N'departments', N'Procurement'), (N'departments', N'Engineering'), (N'departments', N'Quality Assurance'), (N'departments', N'Training'), (N'departments', N'Management'),
    (N'nationalities', N'Malaysian'), (N'nationalities', N'Singaporean'), (N'nationalities', N'British'), (N'nationalities', N'Australian'), (N'nationalities', N'Indian'), (N'nationalities', N'Indonesian'), (N'nationalities', N'American'), (N'nationalities', N'Chinese'),
    (N'religions', N'Islam'), (N'religions', N'Buddhism'), (N'religions', N'Christianity'), (N'religions', N'Hinduism'), (N'religions', N'Taoism'), (N'religions', N'None'), (N'religions', N'Other');

  INSERT INTO dbo.clients (id, company, industry, location, website, type, departments, relationship, blocked, block_reason, blocked_on, last_contact, notes) VALUES
    ('a0000000-0000-4000-8000-000000000001', N'PETRONAS Carigali Sdn Bhd', N'Oil & Gas Exploration and Production', N'Kuala Lumpur, Malaysia', N'www.petronas.com', N'Existing Client', N'["Operations","Procurement","Training"]', N'Best', 0, NULL, NULL, '2026-10-10', N'Long-term partner. Annual renewal in Q1.'),
    ('a0000000-0000-4000-8000-000000000002', N'Shell Malaysia Trading', N'Energy & Petrochemicals', N'Miri, Malaysia', N'www.shell.com.my', N'Contacted', N'["Engineering"]', N'', 0, NULL, NULL, '2026-10-08', N''),
    ('a0000000-0000-4000-8000-000000000003', N'ExxonMobil Exploration', N'Upstream Oil & Gas', N'Singapore', N'www.exxonmobil.com', N'Lead', N'["Management"]', N'', 0, NULL, NULL, '2026-10-05', N''),
    ('a0000000-0000-4000-8000-000000000004', N'TotalEnergies EP', N'Integrated Energy', N'Kuala Lumpur, Malaysia', N'www.totalenergies.com', N'Potential Contact', N'["Training"]', N'', 0, NULL, NULL, '2026-09-12', N''),
    ('a0000000-0000-4000-8000-000000000005', N'BP Exploration', N'Oil & Gas', N'Perth, Australia', N'www.bp.com', N'Bad Lead', N'["Quality Assurance"]', N'', 1, N'Not interested / no budget', '2026-09-01', '2026-09-01', N'');

  -- created_at is staggered so contacts keep their listed order (the first is the primary contact).
  INSERT INTO dbo.contacts (client_id, name, designation, nationality, dob, race, gender, religion, phone, email, reminder, notes, created_at)
  SELECT client_id, name, designation, nationality, dob, race, gender, religion, phone, email, reminder, notes, DATEADD(MILLISECOND, n, SYSUTCDATETIME()) FROM (VALUES
    (1, 'a0000000-0000-4000-8000-000000000001', N'Ahmad Razak', N'Asset Manager', N'Malaysian', '1985-03-12', N'Malay', N'Male', N'Islam', N'+60 12-345 6789', N'ahmad.razak@petronas.com', '2026-11-15', N'Key decision maker for NDT inspection.'),
    (2, 'a0000000-0000-4000-8000-000000000001', N'Nur Aisyah', N'Procurement Executive', N'Malaysian', '1990-07-25', N'Malay', N'Female', N'Islam', N'+60 11-5678 1234', N'aisyah@petronas.com', NULL, N''),
    (3, 'a0000000-0000-4000-8000-000000000001', N'James Tan', N'Technical Engineer', N'Singaporean', '1988-11-03', N'Chinese', N'Male', N'Buddhism', N'+65 8123 4567', N'james.tan@petronas.com', NULL, N''),
    (4, 'a0000000-0000-4000-8000-000000000001', N'Ravi Kumar', N'QA/QC Manager', N'Indian', '1982-05-17', N'Indian', N'Male', N'Hinduism', N'+60 16-2345 6789', N'ravi.kumar@petronas.com', NULL, N''),
    (5, 'a0000000-0000-4000-8000-000000000002', N'Emma Wilson', N'Operations Manager', N'British', '1987-02-14', N'Caucasian', N'Female', N'Christianity', N'+60 16-987 6543', N'emma.wilson@shell.com', '2026-10-22', N'Send quotation.'),
    (6, 'a0000000-0000-4000-8000-000000000003', N'James Lee', N'Procurement Lead', N'Singaporean', '1984-09-09', N'Chinese', N'Male', N'Taoism', N'+65 9123 4567', N'james.lee@exxonmobil.com', '2026-10-20', N'Introduce our services.'),
    (7, 'a0000000-0000-4000-8000-000000000004', N'Siti Nurhaliza', N'QA/QC Manager', N'Malaysian', '1991-01-30', N'Malay', N'Female', N'Islam', N'+60 11-2345 6789', N'siti.nurhaliza@total.com', '2026-10-18', N'Discuss training requirements.'),
    (8, 'a0000000-0000-4000-8000-000000000005', N'David Brown', N'Technical Advisor', N'Australian', '1979-06-21', N'Caucasian', N'Male', N'None', N'+61 428 555 123', N'david.brown@bp.com', NULL, N'')
  ) v(n, client_id, name, designation, nationality, dob, race, gender, religion, phone, email, reminder, notes);
END
