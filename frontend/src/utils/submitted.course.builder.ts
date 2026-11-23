/** Editing routes must not render while a Course awaits approval (BR-83). */
export const isBuilderMutationPath = (pathname: string): boolean => {
  const normalizedPath = pathname.toLowerCase().replace(/\/+$/, "");
  const route = normalizedPath.split("/builder/")[1] ?? "";
  return (
    route === "new-version" ||
    route === "structure/edit" ||
    /^modules\/(?:new|[^/]+\/(?:lessons\/new|delete))$/.test(route) ||
    /^lessons\/[^/]+\/(?:delete|content\/edit|materials\/(?:video\/new|reading\/new|[^/]+\/(?:edit|delete|delete-blocked)))$/.test(route) ||
    /^quizzes\/(?:new|[^/]+\/(?:edit|delete|questions\/(?:new|[^/]+\/edit)))$/.test(route) ||
    /^assignments\/(?:new|[^/]+\/(?:edit|delete|rubric|peer-review))$/.test(route)
  );
};
