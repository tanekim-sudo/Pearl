import { DOMAIN_COMMANDS, executeDomainCommand } from "./domain-commands.js";
import { createPearlEntity, checkpointPearlEntity, pearlEntityObservation } from "./pearl-entity.js";
import { pearlAnimationForCommand, validatePearlAnimation } from "./pearl-animation.js";

export const PEARL_ACTION_PROTOCOL_VERSION = 1;
export const PEARL_ACTION_SURFACES = Object.freeze(["web", "extension", "studio", "companion", "voice", "gesture", "director", "server"]);

const clone = (value) => value == null ? value : structuredClone(value);
const bounded = (value, limit = 220) => String(value ?? "").slice(0, limit);
const id = (prefix) => `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

async function hashMetadata(value, cryptoApi = globalThis.crypto) {
  const digest = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value, Object.keys(value).sort())));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return `sha256-${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "")}`;
}

export function createPearlActionEvent(input = {}) {
  if (!input.pearlId || !input.command || !DOMAIN_COMMANDS[input.command]) throw new Error("Pearl action requires a canonical domain command and Pearl identity");
  const surface = PEARL_ACTION_SURFACES.includes(input.surface) ? input.surface : "companion";
  return {
    protocolVersion: PEARL_ACTION_PROTOCOL_VERSION,
    id: bounded(input.id || id("pearl-action")),
    pearlId: bounded(input.pearlId),
    command: input.command,
    args: clone(input.args || {}),
    surface,
    actor: {
      id: bounded(input.actor?.id || "local-profile"),
      organizationId: input.actor?.organizationId ? bounded(input.actor.organizationId) : null,
      groupIds: (input.actor?.groupIds || []).slice(0, 200).map((entry) => bounded(entry)),
      roles: (input.actor?.roles || []).slice(0, 100).map((entry) => bounded(entry)),
    },
    expectedRevision: input.expectedRevision == null ? null : Math.max(0, Number(input.expectedRevision)),
    idempotencyKey: bounded(input.idempotencyKey || input.id || id("pearl-effect")),
    disclosureApproved: input.disclosureApproved === true,
    destructiveApproved: input.destructiveApproved === true,
    createdAt: Number(input.createdAt) || Date.now(),
  };
}

function resultObject(execution) {
  return execution?.result?.object?.routing
    ? execution.result.object.routing
    : execution?.result?.object || null;
}

function updateEntityFromEffect(entityInput, event, execution, receiptId) {
  const before = createPearlEntity(entityInput);
  let entity = before;
  const object = resultObject(execution);
  if (execution.state?.pearlEntities?.[entity.id]) entity = createPearlEntity(execution.state.pearlEntities[entity.id]);
  else if (object?.id === entity.id && object?.schemaVersion) entity = createPearlEntity(object);
  else if (object?.id === entity.id && event.command.includes("ResultPearl")) entity = createPearlEntity({ ...entity, ...object, kind: "result" });
  else if (object?.id === entity.id && /AutomationPearl/.test(event.command)) entity = createPearlEntity({ ...entity, ...object, kind: "automation" });
  else if (/Privacy/.test(event.command) && object?.pearlId === entity.id) {
    entity = createPearlEntity({ ...entity, privacyPolicy: object, inheritedPrivacyPolicies: entity.privacy.effectivePolicy.provenance.inheritedPolicyIds });
  } else if (/OutputPlacement/.test(event.command) && object) {
    entity = createPearlEntity({ ...entity, outputRouting: object.routing || object });
  } else if (/PearlCanvas/.test(event.command) && object) {
    entity = createPearlEntity({ ...entity, canvas: object });
  }
  return createPearlEntity({
    ...entity,
    revision: entity.revision > before.revision ? entity.revision : entity.revision + 1,
    runtime: {
      ...entity.runtime,
      phase: execution.result?.effects?.some((effect) => /failed|blocked/.test(effect)) ? "failed" : "idle",
      activeSurface: event.surface,
      pendingApproval: null,
      lastEffectReceiptId: receiptId,
      error: null,
    },
    updatedAt: Date.now(),
  });
}

export async function executePearlActionEvent(input = {}) {
  const event = createPearlActionEvent(input.event);
  const entity = createPearlEntity(input.entity);
  if (event.pearlId !== entity.id) throw new Error("Pearl action identity mismatch");
  if (event.expectedRevision != null && event.expectedRevision !== entity.revision) {
    return {
      entity,
      conflict: {
        type: "pearl-action-revision-conflict",
        eventId: event.id,
        expectedRevision: event.expectedRevision,
        actualRevision: entity.revision,
      },
    };
  }
  const replay = entity.history.events.find((entry) => entry.idempotencyKey === event.idempotencyKey);
  if (replay) return { entity, event, replay: true, effectReceipt: replay.effectReceipt, animation: replay.animation, observation: pearlEntityObservation(entity) };
  const command = DOMAIN_COMMANDS[event.command];
  if (command.risk === "high" || command.risk === "medium" && command.confirmation === "preview") {
    if (command.confirmation === "preview" && event.destructiveApproved !== true && /delete|clear|revoke|rotate/i.test(event.command)) {
      throw new Error("explicit destructive action approval is required");
    }
  }
  const checkpointed = checkpointPearlEntity(entity, `before:${event.command}`, { eventId: event.id, idempotencyKey: event.idempotencyKey });
  const execution = await executeDomainCommand(event.command, input.state || {}, {
    ...event.args,
    pearlId: event.args.pearlId || entity.id,
  }, {
    privacyPolicy: entity.privacy.effectivePolicy,
    privacyContext: {
      actorId: event.actor.id,
      organizationId: event.actor.organizationId,
      groupIds: event.actor.groupIds,
      roles: event.actor.roles,
      provider: event.args.provider,
      fields: event.args.fields,
    },
    disclosureApproved: event.disclosureApproved,
    persist: input.persist,
    rollback: input.rollback,
    now: input.now,
    idFactory: input.idFactory,
  });
  const argumentShape = { keys: Object.keys(event.args).sort(), command: event.command, pearlId: entity.id };
  const effectReceipt = {
    version: PEARL_ACTION_PROTOCOL_VERSION,
    type: "pearl-effect-receipt",
    id: id("pearl-effect"),
    eventId: event.id,
    pearlId: entity.id,
    command: event.command,
    surface: event.surface,
    actorRef: event.actor.id,
    idempotencyKey: event.idempotencyKey,
    argumentShapeHash: await hashMetadata(argumentShape),
    effects: clone(execution.result?.effects || []),
    resultType: execution.result?.type || null,
    policyId: entity.privacy.effectivePolicy.id,
    policyVersion: entity.privacy.effectivePolicy.version,
    at: Date.now(),
  };
  const animation = pearlAnimationForCommand(event.command, { effectReceiptId: effectReceipt.id });
  validatePearlAnimation(animation, effectReceipt);
  const createdObject = resultObject(execution);
  if (createdObject?.id && ["automation-pearl", "semantic-orb"].includes(createdObject.kind) && createdObject.id !== entity.id) {
    execution.state = {
      ...execution.state,
      pearlEntities: {
        ...(execution.state.pearlEntities || {}),
        [createdObject.id]: createPearlEntity(createdObject),
      },
    };
  }
  const updated = updateEntityFromEffect(checkpointed.entity, event, execution, effectReceipt.id);
  const eventRecord = {
    id: event.id,
    command: event.command,
    surface: event.surface,
    actorRef: event.actor.id,
    idempotencyKey: event.idempotencyKey,
    effectReceipt,
    animation,
    at: Date.now(),
  };
  const next = createPearlEntity({
    ...updated,
    history: {
      ...updated.history,
      checkpoints: checkpointed.entity.history.checkpoints,
      events: [...updated.history.events, eventRecord].slice(-500),
    },
  });
  return {
    entity: next,
    state: execution.state,
    domainResult: execution.result,
    event,
    effectReceipt,
    animation,
    observation: pearlEntityObservation(next),
    replay: false,
    conflict: null,
  };
}

export function actionEventFromDirectGesture(pearlId, command, args, context = {}) {
  return createPearlActionEvent({ pearlId, command, args, surface: "gesture", ...context });
}

export function actionEventFromCompanion(pearlId, command, args, context = {}) {
  return createPearlActionEvent({ pearlId, command, args, surface: context.voice ? "voice" : "companion", ...context });
}

export function actionEventFromExtensionVerb(pearlId, command, args, context = {}) {
  return createPearlActionEvent({ pearlId, command, args, surface: "extension", ...context });
}
