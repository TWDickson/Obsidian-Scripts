module.exports = {
    entry: start,
    settings: {
        name: "Journal Thought Script",
        author: "Taylor Dickson"
    }
};

async function start(params, settings) {
    /** @type {import("./Quickadd").quickAddApi} */
    const _quickAddApi = params.quickAddApi;
    /** @type {import("./obsidian").App} */
    const app = params.app;
    const variables = params.variables
    /** @type {import("./modalforms").api} */
    const modalForms = app.plugins.plugins.modalforms?.api
    const dataView = app.plugins.plugins.dataview?.api

    const entryDate = moment();
    const entry_date_iso = entryDate.format(); // For frontmatter
    const entry_date_title = entryDate.format("YYYY-MM-DDTHH-mm-ss"); // For filename/title

    let abort = false;

    if (!modalForms) {
        new Notice("Modal Forms plugin is not available.", 5000);
        return;
    }
    if (!dataView) {
        new Notice("Dataview Plugin is not available.", 5000);
    }
    try {
        const builder = modalForms.builder;

        const dvResults = await dataView.pages('"Personal/Locations"')
            .where(p => p.current === true)
            .groupBy(p => p.location)

        /** @type {ModalForms.FormDefinition} */
        const JournalThoughtForm = builder("journal-thought-form", "Journal Thought")
            .text({ name: "subject", label: "Subject" })
            .select({name: "location", label: "Location", options: ['', ...dvResults.values.map((i) => i.key)]})
            .textarea({ name: "entry", label: "Entry", description: "What is on your mind?"})
            .tag({ name: "tags", label: "Tags" })
            .build();

        const formResult = await modalForms.openForm(JournalThoughtForm);

        if (!formResult || formResult.status === "cancelled") {
            // Set abort flag and throw to exit. variables.abort() throws an exception which we don't want to catch
            abort = true;
            throw new Error("Cancelled");
        }

        if (dvResults.values.map((i) => i.key).includes(formResult.data.location)){
            let locationGroup = dvResults.values.find(g => g.key === formResult.data.location);
            let link = locationGroup.rows[0].file.link;
            link.display = locationGroup.key;
            formResult.data.location = link.markdown();
        } else {
            formResult.data.location = '';
        }

        // Set variables for use in QuickAdd templates
        variables.fileName =
            entry_date_title +
            replaceIllegalFileNameCharactersInString(formResult.data.subject);
        variables.entry_date = entry_date_iso;
        Object.assign(variables, formResult.data);

        // Fill Missing fields - no entry provided
        for (let f of JournalThoughtForm.fields) {
            if (!(f.name in variables)){
                variables[f.name] = '';
            }
        }

        return;
    } catch (error) {
        // Check Abort status as abort() triggers an exception which we don't want to catch
        if (abort) {
            params.abort(error.message);
            return;
        }
        console.error("Journal Thought Script:", error);
        new Notice(`Error: ${error.message}`, 5000);
    }
}

function replaceIllegalFileNameCharactersInString(input) {
    if (!input) return "";
    return `_${input
        .replace(/[\\,#%&\{\}\/*<>$'\":@]/g, '')
        .trim()
        .replace(/ /g, '_')}`;
}