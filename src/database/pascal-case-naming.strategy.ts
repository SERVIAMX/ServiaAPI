import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

function toPascalCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Tablas físicas en MySQL (PascalCase, ver database/schema.sql).
 * Si falta `name` en @Entity() o el despliegue usa JS antiguo, TypeORM cae en
 * snake_case del nombre de clase (`user`) y en Linux no coincide con `Users`.
 */
const PASCAL_TABLE_BY_CLASS: Record<string, string> = {
  User: 'Users',
  Client: 'Clients',
  Role: 'Roles',
  Permission: 'Permissions',
  RolePermission: 'RolePermissions',
  RefreshToken: 'RefreshTokens',
  AppModuleEntity: 'AppModules',
};

/**
 * Mapea propiedades camelCase de entidades a columnas PascalCase en MySQL.
 */
export class PascalCaseNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface
{
  override tableName(targetName: string, userSpecifiedName?: string): string {
    if (userSpecifiedName) {
      return userSpecifiedName;
    }
    return PASCAL_TABLE_BY_CLASS[targetName] ?? toPascalCase(targetName);
  }

  override columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    if (customName) {
      return customName;
    }
    if (embeddedPrefixes.length) {
      return (
        embeddedPrefixes.map((p) => toPascalCase(p)).join('') +
        toPascalCase(propertyName)
      );
    }
    return toPascalCase(propertyName);
  }
}
