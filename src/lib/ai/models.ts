/**
 * Models myfi asks the Synapse gateway for.
 *
 * The gateway owns myfi's model policy (which models a myfi key may use and
 * which one is the default), so myfi sends the virtual `auto` model and the
 * gateway resolves it to the policy default. Pinning a concrete id here would
 * drift from the policy and be refused once the policy moves on. The env
 * overrides stay for experiments and must name a model in myfi's policy
 */

type Env = Record<string, string | undefined>;

/** Synapse virtual model the gateway resolves to myfi's default model */
export const GATEWAY_DEFAULT_MODEL = "auto";

/**
 * Output cap for bulk inference. Current models think by default and thinking
 * counts toward the cap, so it leaves room for thinking before the short JSON
 * answer; only the tokens actually generated are billed
 */
export const INFER_MAX_TOKENS = 1024;

const fromEnv = (value: string | undefined): string =>
  value?.trim() || GATEWAY_DEFAULT_MODEL;

/** Model for high-volume import categorization (`MYFI_INFER_MODEL` overrides) */
export const inferModel = (env: Env = process.env): string =>
  fromEnv(env.MYFI_INFER_MODEL);

/** Model for interactive suggestions (`MYFI_CATEGORIZATION_MODEL` overrides) */
export const suggestModel = (env: Env = process.env): string =>
  fromEnv(env.MYFI_CATEGORIZATION_MODEL);
