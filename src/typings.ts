type StringStyleKeys<T = keyof CSSStyleDeclaration> =
    T extends keyof CSSStyleDeclaration
        ? CSSStyleDeclaration[T] extends string
            ? T
            : never
        : never;

export type TeleStyles = Partial<Pick<CSSStyleDeclaration, StringStyleKeys>>;
