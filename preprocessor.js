// Preprocessor used to support new object-oriented command syntax

OBJECT = "object";
FOR = "subject";
TO = "goal";
FROM = "source";
NEAR = "location";
AT = "time";
WITH = "instrument";
IN = "format";
OF = "modifier";
AS = "alias";
BY = "cause";
ON = "dependency"

function camelToKebab(name) {
    let result = name.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
    if (result.startsWith("-"))
        return result.substr(1);
    return result;
}

function extractClasses(script) {
    const rxClassCommand = /(?:\/\*\*(.*?)\*\/\s*)?^\s*class\s*(\w+).*?{/gsm
    const matches = [...script.matchAll(rxClassCommand)];

    return matches.map(m => ({name: m[2], comment: m[1], all: m[0], index: m.index}));
}

function extractProperties(comment) {
    let delay = comment.match(/@delay (\d+)/i);
    let preview = comment.match(/@preview (.*?)(?:\n|$)/i);
    let license = comment.match(/@license (.*?)(?:\n|$)/i);
    let author = comment.match(/@author (.*?)(?:\n|$)/i);
    let icon = comment.match(/@icon (.*?)(?:\n|$)/i);
    let homepage = comment.match(/@homepage (.*?)(?:\n|$)/i);
    let description = comment.match(/@description (.*?)(?:\n|$)/i);
    let uuid = comment.match(/@uuid (.*?)(?:\n|$)/i);
    let noncommand = comment.match(/@noncommand/i);
    let help = comment.replaceAll(/@\w+.*?(?:\n|$)/g, "").trim();

    return {
        delay: delay && delay[1]? parseInt(delay[1]): undefined,
        preview: preview?.[1]?.trim(),
        license: license?.[1]?.trim(),
        author: author?.[1]?.trim(),
        icon: icon?.[1]?.trim(),
        homepage: homepage?.[1]?.trim(),
        description: description?.[1]?.trim(),
        uuid: uuid?.[1]?.trim(),
        noncommand: !!noncommand,
        help: help || undefined,
    }
}

function generateProperty(property) {
    return property? ("\`" + property.replaceAll(/`/g, "\\`") + "\`"): "undefined";
}

function generateSetupBlock(object, properties) {
    let block = `\n{
    let args = {};
    let command = new ${object.name}(args);\n\n`

    if (properties.name)
        block += `    command.name = ${generateProperty(properties.name)};\n`;
    if (properties.delay)
        block += `    command.previewDelay = ${properties.delay || "undefined"};\n`;
    if (properties.preview)
        block += `    command.preview = ${generateProperty(properties.preview)};\n`;
    if (properties.license)
        block += `    command.license = ${generateProperty(properties.license)};\n`;
    if (properties.author)
        block += `    command.author = ${generateProperty(properties.author)};\n`;
    if (properties.icon)
        block += `    command.icon = ${generateProperty(properties.icon)};\n`;
    if (properties.homepage)
        block += `    command.homepage = ${generateProperty(properties.homepage)};\n`;
    if (properties.description)
        block += `    command.description = ${generateProperty(properties.description)};\n`;
    if (properties.help)
        block += `    command.help = ${generateProperty(properties.help)};\n`;
    if (properties.uuid)
        block += `    command.uuid = ${generateProperty(properties.uuid)};\n`;

    block += `\n    CmdManager.addObjectCommand(command, args);\n}\n`;

    return block;
}

function literalChar(c) {
    return c === "\"" || c === "\'" || c === "\`";
}

function extractFullDefinition(script, object) {
    let body = script.substr(object.index + object.all.length - 1);

    // transform most common regex forms to string literals
    body = body.replace(/\/(.+?)\/([a-z\.]+)/g, '"$1"$2');
    body = body.replace(/\((\s*)\/(.+?)\/([^\/)]*)\)/g, '($1"$2"$3)');

    let limit = body.length - 1;
    let stack = 0;
    let ctr = 0;

    let inLiteral = false;
    let inComment = null;

    let c2;

    for (let c of body) {
        if (ctr < limit)
            c2 = body[ctr + 1];

        if (!inLiteral && !inComment && c === "{")
            stack += 1;

        if (!inLiteral && !inComment && c === "}")
            stack -= 1;

        if (!inLiteral && !inComment) {
            if (c === "/") {
                if (c2 === "*")
                    inComment = "*";
                else if (c2 === "/")
                    inComment = "/";
                else
                    inComment = null;
            }
        }

        if (inComment) {
            if (c === "\n" && inComment === "/")
                inComment = null;
            else if (c === "*" && c2 === "/" && inComment === "*")
                inComment = null;
        }

        if (!inComment && !inLiteral && literalChar(c)) {
            inLiteral = true;
            ctr += 1;
            continue;
        }

        if (!inComment && inLiteral && literalChar(c)) {
            inLiteral = false;
            ctr += 1;
            continue;
        }

        if (stack === 0)
            break;

        ctr += 1;
    }

    return script.substring(object.index, object.index + object.all.length + ctr);
}

function runPreprocessor(script) {
    const classMatches = extractClasses(script);

    for (let object of classMatches) {
        let properties = {name: camelToKebab(object.name)}

        if (object.comment)
            Object.assign(properties, extractProperties(object.comment));

        if (object.name.startsWith("_") || properties.noncommand) {
            object.noncommand = true;
            continue;
        }

        object.fullDefinition = extractFullDefinition(script, object);
        object.setupBlock = generateSetupBlock(object, properties);
    }

    for (let object of classMatches)
        if (!object.noncommand)
            script = script.replace(object.fullDefinition, object.fullDefinition + object.setupBlock);

    //console.log(script);

    return script;
}