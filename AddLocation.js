module.exports = {
    entry: start,
    settings: {
        name: "Add Location Script",
        author: "Taylor Dickson"
    }
};

async function start(params, settings) {
    /** @type {import("./Quickadd").quickAddApi} */
    const _quickAddApi = params.quickAddApi;
    /** @type {import("./obsidian").App} */
    const app = params.app;
    const variables = params.variables

    const dataView = app.plugins.plugins.dataview?.api

    const entryDate = moment();
    // Format with local timezone offset (e.g., 2025-11-20T10:26:40.630-05:00)
    const entry_date_iso = entryDate.format(); // Uses ISO 8601 with local offset

    if (!dataView) {
        new Notice("Required plugin Dataview is not available.", 5000);
        return;
    }

    try {
        /*
        File Structure:
        FileName: UUID
        ---
        location: "Location Name"
        latitude: 00.0000
        longitude: 00.0000
        creation date: 2024-01-01T00:00:00.000Z
        address: "123 Main St..."
        current: true
        ---
        */

        // Get Location Names from DataView
        const dvResults = await dataView.pages('"Personal/Locations"')
            .where(p => p.current === true)
            .groupBy(p => p.location)
            .array();
        let locationOptions = dvResults.map(g => g.key).sort();

        // First, get location selection to determine if we can pre-fill
        const location = await _quickAddApi.suggester(
            /* displayItems */ locationOptions,
            /* actualItems */ locationOptions,
            /* placeholder */ "Select Location",
            /* allowCustomInput */ true
        );

        if (!location) {
            new Notice("Location selection cancelled");
            return;
        }

        // Set location variable immediately
        variables.location = location;

        // Check if this is an existing location and get pre-fill data
        const isExistingLocation = locationOptions.includes(location);
        let prefillData = {};

        if (isExistingLocation) {
            console.log("Updating Existing Location:", location);
            const dvLocationGroup = dvResults.find(g => g.key === location);
            const existingData = dvLocationGroup.rows.values[0];
            prefillData = {
                address: existingData.address || "",
                // Convert numbers to strings for form inputs
                latitude: String(existingData.latitude || ""),
                longitude: String(existingData.longitude || "")
            };
            console.log("Pre-fill data from dataview:", JSON.stringify(prefillData));
        }

        // Build form inputs with pre-filled defaults
        const formInputs = [
            {
                id: "address",
                label: "Address",
                type: "text",  // Use text instead of textarea to prevent multiline input
                defaultValue: prefillData.address || "",
                placeholder: "123 Main St., Toronto, Ontario, Canada"
            },
            {
                id: "latitude",
                label: "Latitude",
                type: "text",
                defaultValue: prefillData.latitude || ""
            },
            {
                id: "longitude",
                label: "Longitude",
                type: "text",
                defaultValue: prefillData.longitude || ""
            }
        ];
        const numericFields = ["latitude", "longitude"];

        // requestInputs() writes to choiceExecutor.variables and those values persist through sync
        await _quickAddApi.requestInputs(formInputs);

        // No variables can be modified here as they persist in choiceExecutor.variables
        // Convert numeric fields to floats (requestInputs returns strings)
        // for (let field of numericFields) {
        //     if (variables[field] === "" || variables[field] === undefined) {
        //         variables[field] = 0.0;
        //     } else {
        //         variables[field] = parseFloat(variables[field]);
        //     }
        // }
        // console.log("Converted numeric fields - latitude:", variables.latitude, "longitude:", variables.longitude);

        // Update existing records to set current = false if updating
        if (isExistingLocation) {
            // Update Records to set current = false
            const dvLocationGroup = dvResults.find(g => g.key === variables.location);
            for (let page of dvLocationGroup.rows.values){
                console.log("Setting current = false for:", page.file.path);
                await app.fileManager.processFrontMatter(
                    app.vault.getFileByPath(page.file.path),
                    (frontmatter) => {
                        frontmatter["current"] = false;
                });
            }
        } else {
            console.log("Adding New Location", variables.location);
        }

        // Again variables cannot be modified here as they persist in choiceExecutor.variables
        // Join Address Lines if needed - frontmatter can't handle multiline strings
        // if (variables.address && variables.address.includes('\n')) {
        //     variables.address = variables.address.replace(/\n/g, ', ');
        // }

        // Set variables for use in QuickAdd templates - New variables that don't exist in choiceExecutor.variables can be added
        variables.fileName = crypto.randomUUID();
        variables['creation_date'] = entry_date_iso;
        variables.current = true; // Set current to true for new record

        console.log("FINAL params.variables:", JSON.stringify(params.variables, null, 2));
        return;
    } catch (error) {
        // Check Abort status as abort() triggers an exception which we don't want to catch
        if (error.name === 'MacroAbortError') {
            params.abort(error.message);
            return;
        }
        console.error("Add Location Script:", error);
        new Notice(`Error: ${error.message}`, 5000);
    }
}