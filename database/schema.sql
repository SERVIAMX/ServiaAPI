-- ============================================================
-- ServiaAPI — Schema MySQL 8
-- PKs: BIGINT AUTO_INCREMENT
-- Zona horaria: America/Mexico_City (CST UTC-6)
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;
SET time_zone = 'America/Mexico_City';

CREATE DATABASE IF NOT EXISTS servia_api
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE servia_api;

-- ── Tabla: clients ─────────────────────────────────────────
CREATE TABLE clients (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  businessName    VARCHAR(200)  NOT NULL,
  tradeName       VARCHAR(200)  NULL,
  rfc             VARCHAR(13)   NULL,
  email           VARCHAR(255)  NOT NULL,
  phone           VARCHAR(20)   NULL,
  address         TEXT          NULL,
  city            VARCHAR(100)  NULL,
  state           VARCHAR(100)  NULL,
  postalCode      VARCHAR(10)   NULL,
  country         VARCHAR(100)  NOT NULL DEFAULT 'México',
  isActive        TINYINT(1)    NOT NULL DEFAULT 1,
  logoUrl         VARCHAR(500)  NULL,
  notes           TEXT          NULL,
  createdAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP         COMMENT 'Fecha de registro (CST México)',
  updatedAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP                COMMENT 'Fecha de última actualización (CST México)',
  deletedAt       DATETIME      NULL DEFAULT NULL                          COMMENT 'Fecha de eliminación lógica (CST México)',
  PRIMARY KEY (id),
  UNIQUE KEY uq_clients_email  (email),
  UNIQUE KEY uq_clients_rfc    (rfc),
  INDEX idx_clients_isActive   (isActive),
  INDEX idx_clients_deletedAt  (deletedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tabla: roles ───────────────────────────────────────────
CREATE TABLE roles (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  name            VARCHAR(100)  NOT NULL,
  description     TEXT          NULL,
  isActive        TINYINT(1)    NOT NULL DEFAULT 1,
  isSystem        TINYINT(1)    NOT NULL DEFAULT 0,
  createdAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP         COMMENT 'Fecha de registro (CST México)',
  updatedAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP                COMMENT 'Fecha de última actualización (CST México)',
  deletedAt       DATETIME      NULL DEFAULT NULL                          COMMENT 'Fecha de eliminación lógica (CST México)',
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name     (name),
  INDEX idx_roles_isActive     (isActive),
  INDEX idx_roles_deletedAt    (deletedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tabla: users ───────────────────────────────────────────
CREATE TABLE users (
  id                      BIGINT        NOT NULL AUTO_INCREMENT,
  clientId                BIGINT        NOT NULL,
  roleId                  BIGINT        NOT NULL,
  firstName               VARCHAR(100)  NOT NULL,
  lastName                VARCHAR(100)  NOT NULL,
  email                   VARCHAR(255)  NOT NULL,
  password                VARCHAR(255)  NOT NULL,
  phone                   VARCHAR(20)   NULL,
  isActive                TINYINT(1)    NOT NULL DEFAULT 1,
  isVerified              TINYINT(1)    NOT NULL DEFAULT 0,
  lastLoginAt             DATETIME      NULL                               COMMENT 'Último login (CST México)',
  resetPasswordToken      VARCHAR(255)  NULL,
  resetPasswordExpiresAt  DATETIME      NULL                               COMMENT 'Expiración token reset (CST México)',
  createdAt               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de registro (CST México)',
  updatedAt               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP        COMMENT 'Fecha de última actualización (CST México)',
  deletedAt               DATETIME      NULL DEFAULT NULL                  COMMENT 'Fecha de eliminación lógica (CST México)',
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email    (email),
  INDEX idx_users_clientId     (clientId),
  INDEX idx_users_roleId       (roleId),
  INDEX idx_users_isActive     (isActive),
  INDEX idx_users_deletedAt    (deletedAt),
  CONSTRAINT fk_users_client   FOREIGN KEY (clientId) REFERENCES clients(id) ON UPDATE CASCADE,
  CONSTRAINT fk_users_role     FOREIGN KEY (roleId)   REFERENCES roles(id)   ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tabla: refresh_tokens ──────────────────────────────────
CREATE TABLE refresh_tokens (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  userId          BIGINT        NOT NULL,
  token           TEXT          NOT NULL,
  expiresAt       DATETIME      NOT NULL                                   COMMENT 'Expiración (CST México)',
  isRevoked       TINYINT(1)    NOT NULL DEFAULT 0,
  ipAddress       VARCHAR(45)   NULL,
  userAgent       VARCHAR(500)  NULL,
  createdAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP         COMMENT 'Fecha de registro (CST México)',
  updatedAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP                COMMENT 'Fecha de última actualización (CST México)',
  PRIMARY KEY (id),
  INDEX idx_refresh_tokens_userId    (userId),
  INDEX idx_refresh_tokens_isRevoked (isRevoked),
  CONSTRAINT fk_refresh_tokens_user
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tabla: app_modules ─────────────────────────────────────
CREATE TABLE app_modules (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  name            VARCHAR(100)  NOT NULL,
  label           VARCHAR(100)  NOT NULL,
  description     TEXT          NULL,
  icon            VARCHAR(100)  NULL,
  isActive        TINYINT(1)    NOT NULL DEFAULT 1,
  sortOrder       INT           NOT NULL DEFAULT 0,
  createdAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP         COMMENT 'Fecha de registro (CST México)',
  updatedAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP                COMMENT 'Fecha de última actualización (CST México)',
  PRIMARY KEY (id),
  UNIQUE KEY uq_app_modules_name   (name),
  INDEX idx_app_modules_isActive   (isActive),
  INDEX idx_app_modules_sortOrder  (sortOrder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tabla: permissions ─────────────────────────────────────
CREATE TABLE permissions (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  moduleId        BIGINT        NOT NULL,
  action          ENUM('CREATE','READ','UPDATE','DELETE','EXPORT','IMPORT') NOT NULL,
  description     VARCHAR(255)  NULL,
  createdAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP         COMMENT 'Fecha de registro (CST México)',
  updatedAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP                COMMENT 'Fecha de última actualización (CST México)',
  PRIMARY KEY (id),
  UNIQUE KEY uq_permission_module_action (moduleId, action),
  INDEX idx_permissions_moduleId         (moduleId),
  CONSTRAINT fk_permissions_module
    FOREIGN KEY (moduleId) REFERENCES app_modules(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tabla: role_permissions ────────────────────────────────
CREATE TABLE role_permissions (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  roleId          BIGINT        NOT NULL,
  permissionId    BIGINT        NOT NULL,
  createdAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP         COMMENT 'Fecha de registro (CST México)',
  updatedAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP                COMMENT 'Fecha de última actualización (CST México)',
  PRIMARY KEY (id),
  UNIQUE KEY uq_role_permission               (roleId, permissionId),
  INDEX idx_role_permissions_roleId           (roleId),
  INDEX idx_role_permissions_permissionId     (permissionId),
  CONSTRAINT fk_rp_role
    FOREIGN KEY (roleId)       REFERENCES roles(id)       ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rp_permission
    FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
