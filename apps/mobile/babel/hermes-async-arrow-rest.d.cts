import type { PluginObj, types } from '@babel/core';

declare function hermesAsyncArrowRest(api: { types: typeof types }): PluginObj;
export = hermesAsyncArrowRest;
