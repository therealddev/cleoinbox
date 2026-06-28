// Shared types for Cleoinbox — consumed by the desktop app (v1) and a future
// hosted server (phase 2). Keep provider-agnostic.

/** A Gmail filter: criteria to match incoming mail + actions to apply.
 *  Mirrors the subset of the Gmail API `Filter` resource we write. */
export interface FilterSpec {
  criteria: FilterCriteria
  action: FilterAction
}

export interface FilterCriteria {
  from?: string
  to?: string
  subject?: string
  /** Raw Gmail search query, e.g. "from:uber.com". */
  query?: string
  hasAttachment?: boolean
}

export interface FilterAction {
  addLabelIds?: string[]
  /** Remove INBOX to skip-inbox (archive), UNREAD to mark read, etc. */
  removeLabelIds?: string[]
}

/** A plain-English command compiled into a filter plus an optional pass over
 *  existing mail (Gmail filters never touch the backlog on their own). */
export interface RuleCommand {
  /** The user's original intent, verbatim. */
  intent: string
  filter: FilterSpec
  /** Whether to also archive currently-matching mail (v1: archive only). */
  applyToBacklog: boolean
}
