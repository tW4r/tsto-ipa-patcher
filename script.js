const ORIGINAL_VALUES = {
    "server-url": "https://prod.simpsons-ea.com",
    "syn-dir-url": "https://syn-dir.sn.eamobile.com",
    "dlc-url":
        "https://oct2018-4-35-0-uam5h44a.tstodlc.eamobile.com/netstorage/gameasset/direct/simpsons/",
};

const textEncoder = new TextEncoder();

/**
 * Replace all occurences of `pattern` in `arr` with `replacement`
 * @param {Uint8Array} arr
 * @param {Uint8Array} pattern
 * @param {Uint8Array} replacement
 */
function replace(arr, pattern, replacement) {
    // TODO: Replace with much more efficient implementation
    for (let i = 0; i < arr.length - replacement.length; i++) {
        if (arr.slice(i, i + pattern.length).every((v, j) => v === pattern[j]))
            arr.set(replacement, i);
    }
}

/**
 * Replace all occurences of patterns in `arr` as defined in `replacements`
 * @param {Uint8Array} arr
 * @param {[Uint8Array, Uint8Array][]} replacements
 */
function replaceMultiple(arr, replacements) {
    // TODO: Replace with much more efficient implementation
    for (const [pattern, replacement] of replacements) {
        replace(arr, pattern, replacement);
    }
}

/**
 * Patch a single file inside the IPA
 * @param {unknown} zip 
 * @param {string} path 
 * @param {[Uint8Array, Uint8Array][]} replacements 
 */
async function patchFile(zip, path, replacements) {
    /**
     * @type {string}
     */
    const infoPlist = await zip
        .file(path)
        .async("uint8array");
    // TODO: Add error handling if IPA malformed
    replaceMultiple(infoPlist, replacements);
    zip.file(path, infoPlist);
}

/**
 * Patch IPA
 * @param {File} file
 * @param {[Uint8Array, Uint8Array][]} replacements
 */
async function patch(file, replacements, progress) {
    const zip = await new JSZip().loadAsync(file);
    await Promise.all([
        patchFile(zip, "Payload/Tapped Out.app/Info.plist", replacements),
        patchFile(zip, "Payload/Tapped Out.app/Tapped Out", replacements),
    ]);
    // Remove code signature as it is invalid after patching
    zip.remove('Payload/Tapped Out.app/_CodeSignature');
    return zip.generateAsync({ type: "blob" });
}

/**
 *
 * @param {SubmitEvent} event
 */
function onFormSubmit(event) {
    event.preventDefault();
    event.submitter.disabled = true;
    event.submitter.innerHTML = 'Patching...';
    /**
     * @type {HTMLFormElement}
     */
    const form = event.currentTarget;
    const data = new FormData(form);
    /**
     * @type {File}
     */
    const file = data.get("file");
    /**
     * @type {[Uint8Array, Uint8Array][]}
     */
    const replacements = Object.entries(ORIGINAL_VALUES)
        .map(([name, originalValue]) => {
            const value = data.get(name);
            return value
                ? [textEncoder.encode(originalValue), textEncoder.encode(value)]
                : null;
        })
        .filter(Boolean);

    patch(file, replacements)
        .then((blob) => {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "patched.ipa";
            link.innerText = "Download Patched IPA";
            event.submitter.remove();
            document.getElementById("patch-form").appendChild(link);
        })
        .catch(console.error);
}

