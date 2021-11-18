import { Val, ValCompare, ValDisposer } from "./Val";

export type CombinedValInputTuple<TArr, TMeta> = {
    [K in keyof TArr]: Val<TArr[K], TMeta>;
};

export type CombinedValTransform<TValue, TInputs extends readonly unknown[]> = (
    values: TInputs
) => TValue;

export class CombinedVal<
    TValue,
    TInputs extends readonly unknown[],
    TMeta = any
> extends Val<TValue, TMeta> {
    private _disposers: ValDisposer[];
    private _values: [...TInputs];

    public constructor(
        vals: readonly [...CombinedValInputTuple<TInputs, TMeta>],
        transform: CombinedValTransform<TValue, TInputs>,
        compare?: ValCompare<TValue>
    ) {
        const initValues = vals.map((val) => val.value) as [...TInputs];
        super(transform(initValues), compare);
        this._values = initValues;
        this._disposers = vals.map((val, i) =>
            val.reaction((value, meta) => {
                this._values[i] = value;
                super.setValue(transform(this._values), meta);
            })
        );
    }

    public destroy(): void {
        this._disposers.forEach((disposer) => disposer());
        super.destroy();
    }
}
