/* Copyright (c) 2021, 2023, Oracle and/or its affiliates. Licensed under The Universal Permissive License (UPL), Version 1.0 as shown at https://oss.oracle.com/licenses/upl/ */
import { IAPage } from "@oracle/ia-flows-sdk/IAFlowEngineAPI";
import { useContext } from "preact/hooks";
import { localize } from "../Localizer";
import { ApplicationSession, SessionContext } from "../Session";
import { Row } from "./Row";

interface PageProps {
    page: IAPage;
}

export function Page({page}: PageProps) {
    const session: ApplicationSession = useContext(SessionContext);
    const state = session.getState();

    const previousId = "previous-page-btn";
    const nextId = "next-page-id";

    function navigate(e) {
        const submit = e as SubmitEvent;
        submit.preventDefault();
        if (submit.submitter != null) {
            if (submit.submitter.id == previousId) {
                session.moveToPreviousPage();
            } else if (submit.submitter.id == nextId) {
                session.moveToNextPage();
            }
        }
    }

    return <form class="page" aria-labelledby={page.id} onSubmit={e => navigate(e)}>
        <h1 id={page.id} dangerouslySetInnerHTML={{__html: localize(page.htmlTranslationKey, page.translationParameters, true)}} />
        {page.rows.map(row=><Row row={row}/>)}
        <div class="flow-form-buttons">
            {state.nextPage === null ? null : <input id={nextId} type="submit" value="Next"></input>}
            {state.previousPage === null ? null : <input id={previousId} type="submit" value="Previous"></input>}
        </div>
    </form>
}

