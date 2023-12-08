# Migrator Technical Details

This document contains some detail on how the Intelligent Advisor flow migrator works internally
and how certain situations are handled.   It may be useful when making modifications, or just in
understanding why something works the way it does.

## Project Structure

The migrator is written in TypeScript, the main benefit of which is type definitions that will
help in understanding and extending it.  The migrator depends on the "ia-public-js" folder (also
included in this repository), that contains TypeScript definitions for some Intelligent Advisor
public interfaces, and may also be useful for other custom development.

There are helper functions to handle reading Word and Excel documents and navigating XML, but most
of the actual migration takes place across five source files:
- ExcelMigrator.ts
- WordMigrator.ts
- InterviewScreensMigrator.ts
- DecisionServiceContractHandler
- MigratorCommon.ts

## Migrating Rules

### Translating Rule Structures

In converting each rule document, the migrator does not simply copy the text out of the source
documents.  If it did, many migrated projects would need a substantial amount of manual work to
deal with all the syntax changes from Policy Modeling to web-authored rules.  For example, in an
English-language Policy Modeling project, you can write "the person's income rounded to 2 decimal
places", whereas in web-authored rules you would have to use the functional form: "Round(the
person's income, 2)".

Instead, the migrator uses the parsed rule structures produced by Policy Modeling (the xgen files
in the bin folder of a project) and reconstructs rule text that would produce the same result in 
web-authored rules.

For example, if the original Word rules are:
```
the person's application is still valid if
   the number of months from the application date to the current date < 3 or
   both
      the person has requested an application extension
      and
      the person's request to extend the application has not been denied
```

The compiled xgen would look like this (abbreviated):

```
<conclude attr-id="b2" entity-id="global">
   <value>
      <true-value/>
   </value>
   <condition>
      <or>
         <less-than>
            <month-difference>
               <attribute attr-id="p3"/>
               <current-date/>
            </month-difference>
            <number-value>3</number-value>
         </less-than>
         <and>
            <attribute attr-id="b3"/>
            <not>
               <attribute attr-id="b4"/>
            </not>
         </and>
      </or>
   </condition>
   <otherwise>
      <false-value/>
   </otherwise>
</conclude>
```

From this XML the migrator will reconstruct the following rules:

```
the person's application is still valid if
   MonthDifference(the application date, the current date) < 3 or
   all
      the person has requested an extension and
      not(the extension has been denied)
```

Some things to note in this example:
- The natural language for calculating the month difference is rewritten to use the
  MonthDifference() function.
- "both" is rewritten as "all" and slightly restructured.
- The negative Boolean sentence is rewritten using the Not() function.
- "the current date" was interpreted as a function, but is now a field that is (hopefully) defined
  in the flow scheme.

### Non-Rule Content

Both Word and Excel documents may have content that is not interpreted as rules but is
nevertheless important to the rule author.  This could be headings, explanatory text, or Excel
cells that are not specifically styled using "OPM" cell styles.

While the migrated rules are extracted from the compiled xgen files, the migrator also reads the
original source document and uses that in the migration process.  This is different for Word and 
Excel rule documents:

- For Word documents, the migrator keeps track of its position in both the source document and the
  xgen.  Every rule in the xgen knows where it is in the source document, so as each rule is 
  migrated the migrator sweeps forward in the source document, emitting any non-rule content it 
  finds up until that position.  In this way the migrator is able to interleave the non-rule 
  content and the migrated rules together, in something that should be very close to the original 
  order in the document.

- For Excel documents, non-rule content is skipped, because web-authored rules have no equivalent 
  way to represent it without breaking up the structure (tables must always represent a rule).  
  The text is available to the migrator if it is needed.

### Parenthesis

Parenthesis '(' and ')' are not present in the xgen file, so the migrator can't copy them across
directly.  Instead it looks at the compiled expression and based on operator precedence, it works
out where parenthesis would need to go to produce the same result.

For example, "multiply" has a higher precedence than "add" so where the parsed expression looks
like add(multiply(x,y), z) it will produce "x\*y+z", but multiply(add(x,y),z) will produce
"(x+y)\*z".

This process gives a correct result but means parenthesis added just for readibility will be
lost.  For example, when the original rule says "(a+b)\*(x-y)", it will keep the parenthesis, but
"(a\*b)+(x/y)" will get rewritten as "a\*b+x/y".

### Boolean Negations

Web-authored rules don't automatically recognise the negative phrasing of a Boolean field.  For 
example, "the person does not have a valid license" is not automatically recognized as being 
equivalent to "not(the person has a valid license)" as it would be in Policy Modeling.  This 
requires some adjustments:

- In the condition of a rule, a negative phrase is simply rewritten as "Not(x)"
- In the conclusion of a rule (in a Word document), such as "the person does not have a license 
if ..." then the rule is rewritten as "it is false that the person has a license if ..." and then 
a rule is added "the person has a license = not(it is false that the person has a license)".

### Collapsing "IsUncertain(x) or IsUnknown(x)"

These are both converted into a comparison with null.  For example, "IsUncertain(x)" becomes "x = 
null".

It is also common to test for both cases with "IsUncertain(x) or IsUnknown(x)".  This is collapsed 
down to a single comparison with null, and if these were the only conditions inside the "or", then 
the entire "or" is replaced with the null comparison.

### Intermediate Rules

While translating an expression, the migrator will sometimes find a condition that was allowed 
inside a rule in Policy Modeling, but not in web-authored rules.  In those cases it will create an 
intermediate Boolean field and write the rule for it, schedule it to be added right after the 
current rule, and then continue on with the rule it was in the middle of translating.

One example is with intermediate attributes:

    the license is valid if
        the license has not expired
            the current date < the license expiry date

The intermediate attribute "the license has expired" is both used and proved within the one rule. 
This is not a supported structure in web-authored rules, and unraveling this for web-authored 
rules involves separating out the intermediate into a new rule, but also dealing with the Boolean 
negation (as described above).  When migrated, this example becomes:

    the license is valid if
        Not(the license has expired)

    it is false that the license has expired if
        the current date < the license expiry date

    the license has expired = Not(it is false that the license has expired)

### Mixed Entity Levels in Excel tables

Excel rules allow columns to belong to different entity levels within the same rule, as long as 
the conditions are all available from the entity of each conclusion.  This is most commonly found 
where inferred entities are used, especially if multiple levels of inferred entities are inferred 
within the same table.

The migrator doesn't allow one table to evaluate results for multiple objects, so the migrator 
converts the Excel rule into multiple tables, one table for each entity level in which a 
conclusion exists.

### Apply Sheet Rules

Apply Sheet rules in Excel documents allow attributes to be set to a different value across 
multiple worksheets and then a top-level rule decides which worksheet should be applied to all of 
those attributes.

Web-authored rules don't have an equivalent to this, so instead each rule inside an "apply sheet" 
will have the worksheet name prepended to the attribute name, ensuring each rule concludes a 
different attribute.  Then the top-level rule is rewritten to expand the "apply sheet" column into  column for every attribute, selecting each specific worksheet value when the worksheet's 
conditions are met.

## Migrating Interview Screens 

### Screen Order Behaviour
In a Flow project migrated from an Oracle Policy modeling project, page groups are used to achieve similar entity-level screen order behaviour to the original OPM interview. 

See the following help topics from the Policy Modeling user documentation to understand this behaviour:

- [Understand what entity a screen belongs to](https://documentation.custhelp.com/euf/assets/devdocs/unversioned/IntelligentAdvisor/en/Content/Guides/Use_Intelligent_Advisor/Use_Policy_Modeling/Screens/Understand_what_entity_screen_belongs_to.htm)
- [Control the order of entity-level screens](https://documentation.custhelp.com/euf/assets/devdocs/unversioned/IntelligentAdvisor/en/Content/Guides/Use_Intelligent_Advisor/Use_Policy_Modeling/Screens/Control_order_entity_level_screens.htm)

### Unsupported Features
The following features in Oracle Policy Modeling interviews are not supported. Usages of these features will be ignored by the migrator and associated warnings will be logged to the console:
- Date and time and Time of day attribute types
- "Show/Hide if relevant, otherwise..." rules
- "Optional/Mandatory if relevant, otherwise..." rules
- "Read-only/Enabled if relevant, otherwise..." rules
- Value list references
- Manual lists

## Migrating to a Decision Service project
Date and time and Time of day attribute types are not supported. These attributes will be ignored by the migrator, and associated warnings will be logged to the console.