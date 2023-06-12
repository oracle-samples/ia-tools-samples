/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IAPage } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { localize } from "../Localizer";
import { Row } from "./Row";

interface PageProps {
    page: IAPage;
}

export function Page({page}: PageProps) {
    return <div role="group" class="page" aria-labelledby={page.id}>
        <h1 id={page.id} dangerouslySetInnerHTML={{__html: localize(page.htmlTranslationKey, page.translationParameters, true)}} />
        {page.rows.map(row=><Row row={row}/>)}
    </div>
}

