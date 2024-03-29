import { RuleLanguage } from '../RuleLanguage'

// This could be in a JSON data file, but for now only developers need to edit this, and it's helpful to allow comments
export const FrenchRuleLanguage:RuleLanguage = {
    id:'fr',
    isoName:'fr',
    displayName:'French',

    keywords:{
        and: "et",
        or: "ou",
        if: "si",
        any: "quelconque",
        all: "tous",
        null: "null",
        true: "vrai",
        false: "faux",
        parent: "parent"
    },

    daysOfWeek:["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],

    functions:{
        "Abs": "Abs",
        "Acos": "Acos",
        "AddDays": "AjouterJours",
        "AddMonths": "AjouterMois",
        "AddWeeks": "AjouterSemaines",
        "AddYears": "AjouterAnnées",
        "Asin": "Asin",
        "Atan": "Atan",
        "Contains": "Contient",
        "Cos": "Cos",
        "Count": "Compter",
        "Date": "Date",
        "DayDifference": "DifférenceJours",
        "Default": "ParDéfaut",
        "EndsWith": "SeTerminePar",
        "Ex": "Ex",
        "Exists": "Existe",
        "ExtractDay": "ExtraireJour",
        "ExtractMonth": "ExtraireMois",
        "ExtractYear": "ExtraireAnnée",
        "Filter": "Filtre",
        "Find": "Rechercher",
        "First": "Premier",
        "ForAll": "PourTous",
        "If": "Si",
        "InstanceCount": "InstancesNombre",
        "InstanceCountIf": "InstancesNombreSi",
        "InstanceMaximum": "InstancesMaximum",
        "InstanceMaximumIf": "InstancesMaximumSi",
        "InstanceMinimum": "InstancesMinimum",
        "InstanceMinimumIf": "InstancesMinimumSi",
        "InstanceSum": "InstancesSomme",
        "InstanceSumIf": "InstancesSommeSi",
        "InstanceValueIf": "InstanceValeurSi",
        "Last": "Dernier",
        "Length": "Longueur",
        "Ln": "Ln",
        "Log": "Log",
        "Lower": "Minuscules",
        "Matches": "CorrespondÀ",
        "Maximum": "Maximum",
        "Minimum": "Minimum",
        "MonthDifference": "DifférenceMois",
        "NewLine": "RetourÀLaLigne",
        "NextDayOfTheWeek": "JourSuivantSemaine",
        "Not": "Non",
        "Number": "Nombre",
        "Quote": "Guillemet",
        "Remainder": "Reste",
        "Round": "Arrondi",
        "Sin": "Sin",
        "Sqrt": "RacineCarrée",
        "StartsWith": "CommencePar",
        "Substring": "SousChaîne",
        "Sum":"Somme",
        "Tan": "Tan",
        "Text": "Texte",
        "Trunc": "Troncation",
        "Upper": "Majuscules",
        "WeekDifference": "DifférenceSemaines",
        "WeekdayCount": "NombreJoursSemaine",
        "Xy": "Xy",
        "YearDifference": "DifférenceAnnées"
    }
};
