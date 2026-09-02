import { prospectEstatusFormFieldSchema } from './prospect-estatus.swagger';

const FORM_STRING = { type: 'string' as const };

const locationFormFields = {
  lat: {
    ...FORM_STRING,
    example: '19.432608',
    description: 'Opcional. Latitud del mapa.',
  },
  lng: {
    ...FORM_STRING,
    example: '-99.133209',
    description: 'Opcional. Longitud del mapa.',
  },
  neighborhood: {
    ...FORM_STRING,
    example: 'Centro',
    description: 'Opcional. Colonia / barrio.',
  },
};

const logoFormField = (folder: 'Customers' | 'Prospects') => ({
  type: 'string' as const,
  format: 'binary' as const,
  description: `Opcional. Cualquier formato de archivo (máx. 20 MB) → S3 \`${folder}\`.`,
});

const creditFormFields = {
  requiresCredit: {
    ...FORM_STRING,
    example: 'true',
    description:
      'Obligatorio. `true` = cliente a crédito; `false` = pago inicial en efectivo/transferencia.',
  },
  amount: {
    ...FORM_STRING,
    example: '200',
    description:
      'Condicional: obligatorio si `requiresCredit=false` (debe ser > 0). Monto pagado inicial.',
  },
  creditLine: {
    ...FORM_STRING,
    example: '1000',
    description:
      'Condicional: obligatorio si `requiresCredit=true`. Límite máximo de crédito.',
  },
  discountPercentage: {
    ...FORM_STRING,
    example: '10',
    description: 'Opcional. Porcentaje de bonificación (mínimo 1).',
  },
  commissionPercentage: {
    ...FORM_STRING,
    example: '3.25',
    description: 'Opcional. Porcentaje de comisión (mínimo 1).',
  },
  creditBalance: {
    ...FORM_STRING,
    example: '500',
    description:
      'Condicional: obligatorio si `requiresCredit=true` (debe ser > 0 y ≤ creditLine). Monto de crédito solicitado.',
  },
};

const identityFormFields = {
  businessName: {
    ...FORM_STRING,
    description: 'Obligatorio. Razón social o nombre del negocio.',
  },
  tradeName: {
    ...FORM_STRING,
    description: 'Opcional. Nombre comercial.',
  },
  rfc: {
    ...FORM_STRING,
    description: 'Opcional. RFC mexicano.',
  },
  email: {
    ...FORM_STRING,
    format: 'email',
    description: 'Obligatorio. Correo electrónico.',
  },
  phone: { ...FORM_STRING, description: 'Opcional.' },
  address: { ...FORM_STRING, description: 'Opcional.' },
  city: { ...FORM_STRING, description: 'Opcional.' },
  state: { ...FORM_STRING, description: 'Opcional.' },
  postalCode: { ...FORM_STRING, description: 'Opcional.' },
  country: {
    ...FORM_STRING,
    example: 'México',
    description: 'Opcional. Por defecto `México` si no se envía.',
  },
  notes: { ...FORM_STRING, description: 'Opcional.' },
};

export const clientCreateFormBodySchema = {
  type: 'object',
  required: ['businessName', 'email', 'requiresCredit'],
  properties: {
    ...identityFormFields,
    ...creditFormFields,
    ...locationFormFields,
    logoUrl: logoFormField('Customers'),
  },
};

export const clientUpdateFormBodySchema = {
  type: 'object',
  description:
    'Todos los campos son opcionales (envíe solo lo que desea actualizar). `requiresCredit`, `amount` y `creditBalance` se ignoran.',
  properties: {
    businessName: {
      ...FORM_STRING,
      description: 'Opcional. Razón social o nombre del negocio.',
    },
    tradeName: identityFormFields.tradeName,
    rfc: identityFormFields.rfc,
    email: {
      ...FORM_STRING,
      format: 'email',
      description: 'Opcional. Correo electrónico.',
    },
    phone: identityFormFields.phone,
    address: identityFormFields.address,
    city: identityFormFields.city,
    state: identityFormFields.state,
    postalCode: identityFormFields.postalCode,
    country: identityFormFields.country,
    notes: identityFormFields.notes,
    creditLine: creditFormFields.creditLine,
    discountPercentage: creditFormFields.discountPercentage,
    commissionPercentage: creditFormFields.commissionPercentage,
    ...locationFormFields,
    logoUrl: logoFormField('Customers'),
  },
};

export const prospectCreateFormBodySchema = {
  type: 'object',
  required: ['businessName', 'email'],
  properties: {
    ...identityFormFields,
    estatus: {
      ...prospectEstatusFormFieldSchema,
      description:
        'Opcional. Por defecto `1` (Nuevo). No use `3` (Convertido); use `POST /prospects/:id/convert-to-client`.',
    },
    ...locationFormFields,
    logoUrl: logoFormField('Prospects'),
  },
};

export const prospectUpdateFormBodySchema = {
  type: 'object',
  description:
    'Todos los campos son opcionales (envíe solo lo que desea actualizar). Para cambiar estatus use `PATCH /prospects/:id/estatus`.',
  properties: {
    businessName: {
      ...FORM_STRING,
      description: 'Opcional. Razón social o nombre del negocio.',
    },
    tradeName: identityFormFields.tradeName,
    rfc: identityFormFields.rfc,
    email: {
      ...FORM_STRING,
      format: 'email',
      description: 'Opcional. Correo electrónico.',
    },
    phone: identityFormFields.phone,
    address: identityFormFields.address,
    city: identityFormFields.city,
    state: identityFormFields.state,
    postalCode: identityFormFields.postalCode,
    country: identityFormFields.country,
    notes: identityFormFields.notes,
    ...locationFormFields,
    logoUrl: logoFormField('Prospects'),
  },
};

export const convertProspectFormBodySchema = {
  type: 'object',
  required: ['requiresCredit'],
  description:
    'Campos de saldo/crédito del cliente creado. Los datos del prospecto se copian automáticamente.',
  properties: {
    ...creditFormFields,
    logoUrl: {
      type: 'string',
      format: 'binary',
      description:
        'Opcional. Si no se envía, se usa el logo del prospecto.',
    },
  },
};
