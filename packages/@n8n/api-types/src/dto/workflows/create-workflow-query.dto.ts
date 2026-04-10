import { z } from 'zod';

import { Z } from '../../zod-class';

/**
 * Optional query parameters for POST /workflows.
 *
 * strict=true enables "fail-fast" mode: the request is rejected with 422 if
 * any credentials cannot be resolved. This is designed for CI/CD pipelines
 * and automated import scripts where a broken credential reference should
 * block the deployment rather than silently produce a partially broken workflow.
 */
export class CreateWorkflowQueryDto extends Z.class({
	strict: z.coerce.boolean().optional().default(false),
}) {}
