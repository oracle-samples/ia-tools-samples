export interface NumberFormat {
    zeroPadFractional?: boolean; //if true, format .123 as 0.123. Defaults to true
    negativeStyle: NegativeStyle;

    //thousandth separators. At least one grouping symbol must be provided if the grouping style != none;
    groupingSymbols?: string[];
    groupingStyle: GroupingStyleTypes;

    //decimal options.
    decimalSymbol?: string;
    maxDecimalPlaces?: number; //maximum number of decimal places that can be entered or displayed
    zeroPadMinDecimalPlaces?: boolean; //if true, allows numbers to be specified to less than the number of min decimal places, but pads to minimum on output
    minDecimalPlaces?: number;
    precision?: number;

    //currency styles
    currencySymbol?: string;
    currencySymbolLocation?: 'beforeNumber' | 'afterNumber';
}

type GroupingStyleTypes = 'none'        //1234567
    | 'thirds'      //1,234,567
    | 'firstThird'  //1234,567
    | 'lakhCrore';       //12,34,567

type NegativeStyle = 'bracket' //(123.45), ($123.45), (123.45$)
    | 'leadingMinus'    //-123.45, -$123.45, -123.45$
    | 'trailingMinus'   // 123.45, $123.45-, 123.45$-
    | 'beforeCurrency'  //only applicable if currency symbol is after number eg 123.45-$, otherwise == trailingMinus
    | 'afterCurrency';  //only applicable if currency symbol is before the number eg $-123.45, otherwise == leadingMinus

export interface BooleanFormat {
    trueValue: string;
    falseValue: string;
}

export type DateFormat = (string | DateFormatToken)[];

export interface DateFormatToken {
    kind: DateTokenTypes
}
export type DateTokenTypes =
    'day1Digit'
    | 'day2Digit'
    | 'dayShort'
    | 'dayFull'
    | 'month1Digit'
    | 'month2Digit'
    | 'monthShort'
    | 'monthFull'
    | 'year2Digit'
    | 'year4Digit';

