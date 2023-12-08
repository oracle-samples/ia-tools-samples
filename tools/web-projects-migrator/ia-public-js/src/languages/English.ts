import { RuleLanguage } from '../RuleLanguage'

// This could be in a JSON data file, but for now only developers need to edit this, and it's helpful to allow comments
export const EnglishRuleLanguage:RuleLanguage = {
    id:'en',
    isoName:'en',
    displayName:'English',

    keywords:{
        and: "and",
        or: "or",
        if: "if",
        any: "any",
        all: "all",
        null: "null",
        true: "true",
        false: "false",
        parent: "parent"
    },

    // No overrides required - English names are always accepted
    daysOfWeek:null,

    // Translations that are absent are not available at all, so this should not be empty
    functions:null
};

