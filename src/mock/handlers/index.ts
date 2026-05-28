import { auditHandlers } from './audit';
import { authHandlers } from './auth';
import { businessTypeHandlers } from './business-type';
import { chatHandlers } from './chat';
import { departmentHandlers } from './department';
import { eformHandlers } from './eform';
import { knowledgeHandlers } from './knowledge';
import { staffHandlers } from './staff';

export const handlers = [
  ...authHandlers,
  ...staffHandlers,
  ...businessTypeHandlers,
  ...departmentHandlers,
  ...knowledgeHandlers,
  ...eformHandlers,
  ...chatHandlers,
  ...auditHandlers,
];
