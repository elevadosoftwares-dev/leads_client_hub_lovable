-- Leads Client Hub - SQL Server schema.
-- Applied automatically when the app first connects (src/server/db.server.ts), after creating
-- the database if needed. Safe to re-run: every object is created only if it does not exist.
-- Separate batches with a line containing only GO. To apply by hand:
--   sqlcmd -S <server> -U <user> -P <password> -d leads_client_hub -i database/schema.sql

SET NOCOUNT ON;

-- Editable dropdown values. category is one of: types, departments, nationalities, religions.
IF OBJECT_ID(N'dbo.master_options', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.master_options (
    category   NVARCHAR(20)  NOT NULL
      CONSTRAINT ck_master_options_category CHECK (category IN (N'types', N'departments', N'nationalities', N'religions')),
    value      NVARCHAR(100) NOT NULL
      CONSTRAINT ck_master_options_value CHECK (LEN(value) BETWEEN 1 AND 100),
    sort_order INT           NOT NULL CONSTRAINT df_master_options_sort_order DEFAULT 0,
    CONSTRAINT pk_master_options PRIMARY KEY (category, value)
  );
  INSERT INTO dbo.master_options (category, value, sort_order) VALUES
    (N'types', N'Lead', 1), (N'types', N'Contacted', 2), (N'types', N'Existing Client', 3),
    (N'types', N'Potential Contact', 4), (N'types', N'Bad Lead', 5),
    (N'departments', N'Operations', 1), (N'departments', N'Procurement', 2),
    (N'departments', N'Engineering', 3), (N'departments', N'Quality Assurance', 4),
    (N'departments', N'Training', 5), (N'departments', N'Management', 6),
    (N'nationalities', N'Malaysian', 1), (N'nationalities', N'Singaporean', 2),
    (N'nationalities', N'British', 3), (N'nationalities', N'Australian', 4),
    (N'nationalities', N'Indian', 5), (N'nationalities', N'Indonesian', 6),
    (N'nationalities', N'American', 7), (N'nationalities', N'Chinese', 8),
    (N'religions', N'Islam', 1), (N'religions', N'Buddhism', 2), (N'religions', N'Christianity', 3),
    (N'religions', N'Hinduism', 4), (N'religions', N'Taoism', 5), (N'religions', N'None', 6),
    (N'religions', N'Other', 7);
END

-- Client companies. seq keeps a stable "newest first" order.
IF OBJECT_ID(N'dbo.clients', N'U') IS NULL
CREATE TABLE dbo.clients (
  id            NVARCHAR(50)  NOT NULL CONSTRAINT pk_clients PRIMARY KEY,
  seq           INT           IDENTITY(1, 1) NOT NULL,
  company       NVARCHAR(200) NOT NULL CONSTRAINT uq_clients_company UNIQUE
    CONSTRAINT ck_clients_company CHECK (LEN(company) BETWEEN 1 AND 200),
  industry      NVARCHAR(200) NOT NULL CONSTRAINT df_clients_industry DEFAULT N'',
  location      NVARCHAR(200) NOT NULL CONSTRAINT df_clients_location DEFAULT N'',
  website       NVARCHAR(255) NOT NULL CONSTRAINT df_clients_website DEFAULT N'',
  type          NVARCHAR(100) NOT NULL CONSTRAINT df_clients_type DEFAULT N'',
  talent        NVARCHAR(30)  NULL,
  relationship  NVARCHAR(20)  NULL,
  blocked       BIT           NOT NULL CONSTRAINT df_clients_blocked DEFAULT 0,
  block_reason  NVARCHAR(200) NULL,
  blocked_on    DATE          NULL,
  last_contact  DATE          NULL,
  notes         NVARCHAR(50)  NOT NULL CONSTRAINT df_clients_notes DEFAULT N'',
  created_at    DATETIME2(3)  NOT NULL CONSTRAINT df_clients_created_at DEFAULT SYSUTCDATETIME(),
  updated_at    DATETIME2(3)  NOT NULL CONSTRAINT df_clients_updated_at DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID(N'dbo.client_departments', N'U') IS NULL
CREATE TABLE dbo.client_departments (
  client_id  NVARCHAR(50)  NOT NULL
    CONSTRAINT fk_client_departments_client REFERENCES dbo.clients(id) ON DELETE CASCADE,
  department NVARCHAR(100) NOT NULL,
  CONSTRAINT pk_client_departments PRIMARY KEY (client_id, department)
);

-- Contact persons of a client company.
IF OBJECT_ID(N'dbo.contacts', N'U') IS NULL
CREATE TABLE dbo.contacts (
  id           NVARCHAR(50)   NOT NULL CONSTRAINT pk_contacts PRIMARY KEY,
  seq          INT            IDENTITY(1, 1) NOT NULL,
  client_id    NVARCHAR(50)   NOT NULL
    CONSTRAINT fk_contacts_client REFERENCES dbo.clients(id) ON DELETE CASCADE,
  name         NVARCHAR(100)  NOT NULL,
  designation  NVARCHAR(100)  NOT NULL CONSTRAINT df_contacts_designation DEFAULT N'',
  nationality  NVARCHAR(100)  NOT NULL CONSTRAINT df_contacts_nationality DEFAULT N'',
  dob          DATE           NULL,
  race         NVARCHAR(50)   NOT NULL CONSTRAINT df_contacts_race DEFAULT N'',
  gender       NVARCHAR(20)   NOT NULL CONSTRAINT df_contacts_gender DEFAULT N'',
  religion     NVARCHAR(100)  NOT NULL CONSTRAINT df_contacts_religion DEFAULT N'',
  phone        NVARCHAR(25)   NOT NULL CONSTRAINT df_contacts_phone DEFAULT N'',
  email        NVARCHAR(255)  NOT NULL CONSTRAINT df_contacts_email DEFAULT N'',
  reminder     DATE           NULL,
  notes        NVARCHAR(1000) NOT NULL CONSTRAINT df_contacts_notes DEFAULT N'',
  talent       NVARCHAR(30)   NULL,
  relationship NVARCHAR(20)   NULL,
  created_at   DATETIME2(3)   NOT NULL CONSTRAINT df_contacts_created_at DEFAULT SYSUTCDATETIME(),
  updated_at   DATETIME2(3)   NOT NULL CONSTRAINT df_contacts_updated_at DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_contacts_client_id')
  CREATE INDEX ix_contacts_client_id ON dbo.contacts(client_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_contacts_reminder')
  CREATE INDEX ix_contacts_reminder ON dbo.contacts(reminder) WHERE reminder IS NOT NULL;
