-- ============================================================
-- ServiaAPI — Seed inicial
-- ============================================================

USE servia_api;
SET time_zone = 'America/Mexico_City';
SET FOREIGN_KEY_CHECKS = 0;

-- ── Cliente inicial ────────────────────────────────────────
INSERT INTO clients (businessName, email, country, isActive)
VALUES ('ServiaAPI Core', 'admin@servia.com', 'México', 1);

SET @client_id = LAST_INSERT_ID();

-- ── Rol Super Administrador ────────────────────────────────
INSERT INTO roles (name, description, isActive, isSystem)
VALUES ('Super Administrador', 'Acceso total al sistema', 1, 1);

SET @role_id = LAST_INSERT_ID();

-- ── Usuario administrador inicial ─────────────────────────
-- password plano: Admin123!
INSERT INTO users (
  clientId, roleId, firstName, lastName,
  email, password, isActive, isVerified
) VALUES (
  @client_id,
  @role_id,
  'Admin',
  'ServiaAPI',
  'admin@servia.com',
  '$2b$10$DYGDC6hvbC5SxNdccy0.e..fKXgL66r6Aa47mJGpe8VoJK7.4RGrO',
  1,
  1
);

-- ── Módulos del sistema ────────────────────────────────────
INSERT INTO app_modules (name, label, icon, sortOrder) VALUES
  ('users',   'Usuarios', 'users',    1),
  ('clients', 'Clientes', 'building', 2),
  ('roles',   'Roles',    'shield',   3),
  ('modules', 'Módulos',  'grid',     4),
  ('auth',    'Auth',     'lock',     5);

SET @mod_users   = (SELECT id FROM app_modules WHERE name = 'users');
SET @mod_clients = (SELECT id FROM app_modules WHERE name = 'clients');
SET @mod_roles   = (SELECT id FROM app_modules WHERE name = 'roles');
SET @mod_modules = (SELECT id FROM app_modules WHERE name = 'modules');
SET @mod_auth    = (SELECT id FROM app_modules WHERE name = 'auth');

-- ── Permisos por módulo ────────────────────────────────────
INSERT INTO permissions (moduleId, action, description) VALUES
  (@mod_users,   'CREATE', 'Crear usuarios'),
  (@mod_users,   'READ',   'Ver usuarios'),
  (@mod_users,   'UPDATE', 'Editar usuarios'),
  (@mod_users,   'DELETE', 'Eliminar usuarios'),
  (@mod_users,   'EXPORT', 'Exportar usuarios'),

  (@mod_clients, 'CREATE', 'Crear clientes'),
  (@mod_clients, 'READ',   'Ver clientes'),
  (@mod_clients, 'UPDATE', 'Editar clientes'),
  (@mod_clients, 'DELETE', 'Eliminar clientes'),
  (@mod_clients, 'EXPORT', 'Exportar clientes'),

  (@mod_roles,   'CREATE', 'Crear roles'),
  (@mod_roles,   'READ',   'Ver roles'),
  (@mod_roles,   'UPDATE', 'Editar roles'),
  (@mod_roles,   'DELETE', 'Eliminar roles'),

  (@mod_modules, 'CREATE', 'Crear módulos'),
  (@mod_modules, 'READ',   'Ver módulos'),
  (@mod_modules, 'UPDATE', 'Editar módulos'),
  (@mod_modules, 'DELETE', 'Eliminar módulos'),

  (@mod_auth,    'READ',   'Ver sesiones activas'),
  (@mod_auth,    'DELETE', 'Revocar sesiones');

-- ── Asignar TODOS los permisos al Super Administrador ─────
INSERT INTO role_permissions (roleId, permissionId)
SELECT @role_id, id FROM permissions;

SET FOREIGN_KEY_CHECKS = 1;
