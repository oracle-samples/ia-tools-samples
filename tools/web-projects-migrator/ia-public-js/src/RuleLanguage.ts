import { EnglishRuleLanguage } from "./languages/English";
import { FrenchRuleLanguage } from "./languages/French";
import { SpanishRuleLanguage } from "./languages/Spanish";

/** Gets a predefined language, or null if it doesn't exist */
export function getRuleLanguage(id:string):RuleLanguage {
    return languages.find(lang => lang.id === id) ?? null;
}

interface RuleLanguageOption {
    /** Identifier stamped into the project.  Once chosen for a language, don't ever change this */
    id:string;
    /** What to show the user. Should the language's own name for itself, because this won't be otherwise translated. */
    displayName:string;
    /** Matched against the browser's locale to select a preferred rule language the first time a user creates a project */
    isoName:string;
}

export interface Translations {
    [from:string]:string;
}

/** This interface is separated with the expectation that rule language details would be lazy-loaded down the track */
export interface RuleLanguage extends RuleLanguageOption {
    keywords:{
        and:string;
        or:string;
        if:string;
        any:string;
        all:string;
        null:string;
        true:string;
        false:string;
        parent:string;
    };

    /** Days of the week listed from Sunday to Saturday */
    daysOfWeek:[string,string,string,string,string,string,string];

    /** If null, English names are used. Otherwise these names are used instead of the English function names,
     * but untranslated functions will not be available at all. */
    functions:Translations;
}

/** First one will be the default in case no better default can be found */
const languages = [
    EnglishRuleLanguage, FrenchRuleLanguage, SpanishRuleLanguage
];

export const ruleLanguageOptions:RuleLanguageOption[] = languages.map(({id,isoName,displayName}) => ({id,isoName,displayName}));
