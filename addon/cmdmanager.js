import {settings} from "./settings.js";
import {repository} from "./storage.js";
import {fetchJSON} from "./utils.js";

// !!! Builtin command classes and noun types should be exported in their corresponding files
class CommandNamespace {
    name;
    annotated;
    commands = [];
    onModuleCommandsLoaded; // triggered when all module commands are loaded
    onBuiltinCommandsLoaded; // triggered when all builtin commands are loaded

    constructor(name, annotated) {
        this.name = name;
        this.annotated = annotated;
    }

    createCommand(options) {
        const command = cmdAPI.createCommand(options);
        if (command)
            this.commands.push(command);
        return command;
    }

    createSearchCommand(options) {
        const command = cmdAPI.createSearchCommand(options);
        if (command)
            this.commands.push(command);
        return command;
    }

    createCaptureCommand(options) {
        const command = cmdAPI.createCaptureCommand(options);
        if (command)
            this.commands.push(command);
        return command;
    }

    assignNamespaceToCommands(builtin) {
        this.commands.forEach(c => {
            c._namespace = this.name;
            c._builtin = builtin;
        })
    }
}

class AnnotatedCommandNamespace extends CommandNamespace {
    constructor(name) {
        super(name, true);
    }
}

class APIProxyHandler {
    #commandNamespace;
    #nop;

    constructor(commandNamespace, nop) {
        this.#commandNamespace = commandNamespace;
        this.#nop = nop;
    }

    creationMethod(method) {
        if (this.#nop)
            return () => null;
        else
            return (...args) => method.call(this.#commandNamespace, ...args);
    }

    get(target, property, receiver) {
        switch (property) {
            case "createCommand":
            case "CreateCommand":
                return this.creationMethod(!this.#nop && this.#commandNamespace.createCommand);
            case "createSearchCommand":
            case "makeSearchCommand":
                return this.creationMethod(!this.#nop && this.#commandNamespace.createSearchCommand);
            case "createCaptureCommand":
            case "makeCaptureCommand":
                return this.creationMethod(!this.#nop && this.#commandNamespace.createCaptureCommand);

            default:
                let value = target[property];
                if (typeof value === "function")
                    value = value.bind(target);
                return value;
        }
    }

    set(target, property, value, receiver) {
        return target[property] = value;
    }

    has(target, key) {
        return key in target;
    }
}

class CommandManager {
    ns = { // command namespaces
        ISHELL: "iShell",
        BROWSER: "Browser",
        AI: "AI",
        TABS: "Tabs",
        UTILITY: "Utility",
        SEARCH: "Search",
        SYNDICATION: "Syndication",
        MAIL: "Mail",
        TRANSLATION: "Translation",
        SCRAPYARD: "Scrapyard",
        MORE: "More Commands"
    };

    #userCommandNamespaces = [];

    // ! sic, replaced by mkcommands.py
    #builtinCommandFiles = [
        "/commands/browser.js",
        "/commands/color-picker.js",
        "/commands/feedsub.js",
        "/commands/google.js",
        "/commands/history.js",
        "/commands/ishell.js",
        "/commands/lingvo.js",
        "/commands/literature.js",
        "/commands/mail.js",
        "/commands/new-tab.js",
        "/commands/pinterest.js",
        "/commands/resurrect.js",
        "/commands/scrapyard.js",
        "/commands/search.js",
        "/commands/tab-groups.js",
        "/commands/tabs.js",
        "/commands/translate.js",
        "/commands/unicode.js",
        "/commands/utility.js",
        "/commands/aichat/aichat.js",
        "/commands/aichat/gpt.js",
        "/commands/more/javlib.js",
        "/commands/more/kpop.js",
        "/commands/more/more.js",
        "/commands/more/nyaa.js"
    ];

    constructor() {
        this._commands = [];
        this._disabledCommands = settings.disabled_commands() || {};
    }

    async makeParser() {
        return NLParser.makeParserForLanguage("en", this._commands);
    };

    createCommand(options) {
        if (Array.isArray(options.name)) {
            options.names = options.name;
            options.name = options.name[0];
        } else {
            options.name = options.name || options.names[0];
            options.names = options.names || [options.name];
        }

        if (!options.uuid) {
            if (options.homepage)
                options.uuid = options.homepage;
            else
                options.uuid = options.name;
        }

        options.id = options.uuid;

        if (this._commands.some(c => c.id === options.id))
            return null;

        if (options._namespace)
            options._builtin = true;

        let args = options.arguments || options.argument;
        if (!args)
            args = options.arguments = [];

        let nounId = 0;
        function toNounType(obj, key) {
            let val = obj[key];
            if (!val) return;
            let noun = obj[key] = NounUtils.NounType(val);
            if (!noun.id) noun.id = options.id + "#n" + nounId++;
        }

        ASSIGN_ARGUMENTS:
        {
            // handle simplified syntax
            if (typeof args.suggest === "function")
                // argument: noun
                args = [{role: "object", nountype: args}];
            else if (!Array.isArray(args)) {
                // arguments: {role: noun, ...}
                // arguments: {"role label": noun, ...}
                let a = [], re = /^[a-z]+(?=(?:[$_:\s]([^]+))?)/;
                for (let key in args) {
                    let [role, label] = re.exec(key) || [];
                    if (role) a.push({role: role, label: label, nountype: args[key]});
                }
                args = a;
            }
            for (let arg of args) toNounType(arg, "nountype");
            options.arguments = args;
        }

        let timeout = parseInt(options.timeout || options.previewDelay);
        if (timeout > 0 && typeof options.preview === 'function')
            this._assignDelayedPreview(options, timeout);

        options.previewDefault = CmdUtils.CreateCommand.previewDefault;

        this._commands.push(options);

        return options;
    }

    _assignDelayedPreview(options, timeout) {
        options.__delayed_preview = options.preview;
        options.preview = function (pblock) {
            const args = arguments;
            const callback = CmdUtils.previewCallback(pblock, options.__delayed_preview);
            if (options.__preview_timeout) {
                clearTimeout(options.__preview_timeout);
                options.__preview_resolve && options.__preview_resolve(undefined);
            }
            let previewResolve, previewReject;
            const result = new Promise((resolve, reject) => {
                previewResolve = options.__preview_resolve = resolve;
                previewReject = reject;
            });
            options.__preview_timeout = setTimeout(async function () {
                try {
                    const callbackResult = await callback.apply(options, args);
                    previewResolve(callbackResult);
                } catch (e) {
                    previewReject(e);
                }
                options.__preview_timeout = null;
                delete options.__preview_resolve;
            }, timeout);
            return result;
        };
    }

    getCommandByUUID(uuid) {
        return this._commands.find(c => c.uuid.toUpperCase() === uuid.toUpperCase());
    };

    getCommandByName(name) {
        for (let c in this._commands)
            if (this._commands[c].name === name || this._commands[c].names.indexOf(name) > -1)
                return this._commands[c];
        return null;
    };
    
    removeCommand(command) {
        this._commands = this._commands.filter(cmd => cmd.id !== command.id);
    }

    get commands() {
        return this._commands;
    }

    set commands(commands) {
        this._commands = commands;
    }

    get builtinCommands() {
        return this._commands.filter(c => c._builtin)
    }

    get userCommands() {
        return this._commands.filter(c => !c._builtin)
    }

    enableCommand(cmd) {
        if (cmd.name in this._disabledCommands) {
            delete this._disabledCommands[cmd.name];
            settings.load().then(() => {
                settings.disabled_commands(this._disabledCommands);
            });
        }
    };

    disableCommand(cmd) {
        if (!(cmd.name in this._disabledCommands)) {
            this._disabledCommands[cmd.name] = true;
            settings.load().then(() => {
                settings.disabled_commands(this._disabledCommands);
            });
        }
    };

    toCommand(object) {
        let command = object;
        if (object instanceof ParsedSentence)
            command = object.getCommand();
        return command;
    }

    _printCommandError(object, method, error) {
        const command = this.toCommand(object);
        console.error(`iShell command: ${command.name}, ${method}\n${error.toString()}\n${error.stack}`);
    }

    // adds a storage bin obtained from the command uuid as the last argument of the called function
    async _callCommandHandler(object, handler, ...args) {
        const command = this.toCommand(object);
        const bin = await Utils.makeBin(command.uuid);

        args.push(bin);
        return handler.apply(object, args);
    }

    async _callCommandHandlerCatching(object, handler, method, ...args) {
        try {
            await this._callCommandHandler(object, handler, ...args);
        } catch (e) {
            if (!this._skipLogingException(e))
                this._printCommandError(object, method, e);
        }
    }

    _skipLogingException(e) {
        if (cmdAPI.fetchAborted(e))
            return true;
        else if (e.message === "can't access dead object")
            return true;
        return false;
    }

    callPreview(sentence, pblock) {
        return this._callCommandHandlerCatching(sentence, sentence.preview, "preview", pblock);
    }

    async callExecute(sentence) {
        return this._callCommandHandlerCatching(sentence, sentence.execute, "execute");
    }

    async loadBuiltinCommands() {
        if (settings.platform.chrome)
            this.#builtinCommandFiles = this.#builtinCommandFiles.filter(f => !f.includes("/tab-groups.js"));

        const modules = [];
        for (const path of this.#builtinCommandFiles)
            modules.push(this._loadBuiltinCommandModule(path));

        await Promise.all(modules);

        for (let module of modules) {
            module = await module;

            if (module?.namespace?.onBuiltinCommandsLoaded)
                try {
                    await module.namespace.onBuiltinCommandsLoaded();
                } catch (e) {
                    console.error(e);
                }
        }
    }

    async _loadBuiltinCommandModule(path) {
        let module;

        try {
            module = await import(path);
        } catch (e) {
            console.error(`Error loading module: ${path}`, e);
        }

        if (module?.namespace && module?.namespace?.name) {
            if (module.namespace.annotated)
                await this._loadAnnotatedCommandModule(path);

            module.namespace.assignNamespaceToCommands(true);

            if (module.namespace.onModuleCommandsLoaded)
               try {
                   await module.namespace.onModuleCommandsLoaded();
               } catch (e) {
                   console.error(e);
               }

            return module;
        }
        else if (module)
            console.log("module '%s' has no namespace", path);
    }

    async loadBundledUserCommands() {
        let commandFiles = await fetchJSON("/commands-user.json");
        commandFiles = commandFiles.filter(f => !f.includes("/example.js"));

        const modules = [];
        for (const path of commandFiles)
            modules.push(this._loadUserCommandModule(path));

        await Promise.all(modules);
    }

    async _loadUserCommandModule(path) {
        const module = await this._loadAnnotatedCommandModule(path, CommandPreprocessor.CONTEXT_USER);
        module.namespace.assignNamespaceToCommands();
    }

    async _loadAnnotatedCommandModule(path, context = CommandPreprocessor.CONTEXT_BUILTIN) {
        const preprocessor = new CommandPreprocessor(context);
        return preprocessor.load(path);
    }

    async loadUserCommands(namespace) {
        const preprocessor = new CommandPreprocessor(CommandPreprocessor.CONTEXT_USER);
        let userscripts = await repository.fetchUserScripts(namespace);

        if (namespace)
            userscripts = [userscripts];

        this.unloadUserCommands(namespace);
        await this.loadBundledUserCommands();

        this.#userCommandNamespaces = [];

        const loadedScripts = [];
        for (let record of userscripts) {
            try {
                if (record.script) {
                    const script = preprocessor.transform(record.script);
                    const preamble = this.generateUserCommandLoadPreamble(record.namespace);
                    if (_BACKGROUND_PAGE) {
                        const promise = cmdAPI.evaluate(preamble + script);
                        loadedScripts.push(promise);
                    }
                    else // parallel evaluation of user scripts makes Chrome to crash
                        await cmdAPI.evaluate(preamble + script);

                }
            } catch (e) {
                console.error("custom script evaluation failed", e);
            }
        }

        if (_BACKGROUND_PAGE)
            await Promise.all(loadedScripts);

        for (const namespace of this.#userCommandNamespaces)
            namespace.assignNamespaceToCommands(false);
        this.#userCommandNamespaces = [];
    }

    async evalUserScriptForErrors(namespace, script) {
        const preprocessor = new CommandPreprocessor(CommandPreprocessor.CONTEXT_USER);
        const preamble = this.generateUserCommandEvalPreamble();
        const code = preprocessor.transform(script);

        let error;
        try {
            const result = await cmdAPI.evaluate(preamble + code);

            if (_MANIFEST_V3)
                await result.error;
        }
        catch (e) {
            error = e;
        }

        return {
            success: !error,
            error
        }
    }

    generateUserCommandLoadPreamble(namespace) {
        const namespaceEscaped = namespace.replace("\"", "\\\"");
        return `const __namespace__ = new CommandNamespace("${namespaceEscaped}");
_BACKGROUND_API.cmdManager.addUserCommandNamespace(__namespace__);
const CmdUtils = _BACKGROUND_API.cmdManager.createAPIProxy(__namespace__, _BACKGROUND_API.CmdUtils);
const cmdAPI = _BACKGROUND_API.cmdManager.createAPIProxy(__namespace__, _BACKGROUND_API.cmdAPI);
`.replace(/\n/g, "");
    }

    generateUserCommandEvalPreamble() {
        return `const CmdUtils = _BACKGROUND_API.cmdManager.createAPIProxy(null, _BACKGROUND_API.CmdUtils, true); 
const cmdAPI = _BACKGROUND_API.cmdManager.createAPIProxy(null, _BACKGROUND_API.cmdAPI, true);
`.replace(/\n/g, "");
    }

    addUserCommandNamespace(namespace) {
        this.#userCommandNamespaces.push(namespace);
    }

    createAPIProxy(commandNamespace, api, nop) {
        return new Proxy(api, new APIProxyHandler(commandNamespace, nop));
    }

    unloadUserCommands(namespace) {
        if (namespace)
            this._commands = this._commands.filter(c => c._namespace !== namespace);
        else
            this._commands = this._commands.filter(c => c._builtin);
    }

    async loadCommands() {
        await this.loadBuiltinCommands();

        const canLoadUserScripts = !_MANIFEST_V3 || _MANIFEST_V3 && !_BACKGROUND_PAGE
            /*|| _MANIFEST_V3 && _BACKGROUND_PAGE && await helperApp.probe()*/;

        if (canLoadUserScripts)
            await cmdManager.loadUserCommands();

        await this._prepareCommands();
    }

    async _prepareCommands() {
        this._commands = this._commands.filter(cmd => !cmd._hidden || cmdAPI.DEBUG && cmd._debug);

        for (const cmd of this._commands)
            if (cmd.name in this._disabledCommands)
                cmd.disabled = true;

        return this._initializeCommands();
    }

    async _initializeCommands() {
        for (const cmd of this._commands)
            if (cmd.load && !cmd.disabled)
                await this._callCommandHandlerCatching(cmd, cmd.load, "load");
    }

    async initializeCommandsOnPopup(doc) {
        for (const cmd of this._commands)
            if (cmd.init && !cmd.disabled)
                await this._callCommandHandlerCatching(cmd, cmd.init, "init", doc);
    }

    commandHistoryPush(input) {
        if (input) {
            input = input.trim();

            let history = localStorage.getItem("command_history") || "[]";
            history = JSON.parse(history);

            ADD_ITEM: {
                if (history.length && history[0].toUpperCase() === input.toUpperCase())
                    break ADD_ITEM;

                history = [input, ...history];

                if (history.length > settings.max_history_items())
                    history.splice(history.length - 1, 1);

                history = JSON.stringify(history);
                localStorage.setItem("command_history", history);
            }
        }
    }

    getCommandHistory() {
        let history = localStorage.getItem("command_history") || "[]";
        return JSON.parse(history);
    }
}

export const cmdManager = new CommandManager();

for (const ns in cmdManager.ns)
    CommandNamespace[ns] = cmdManager.ns[ns];

globalThis.CommandNamespace = CommandNamespace;
globalThis.AnnotatedCommandNamespace = AnnotatedCommandNamespace;