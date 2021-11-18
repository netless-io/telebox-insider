import { Val, ValCompare, ValDisposer } from "./Val";

export type ComputedValTransform<TValue, TUpstream> = (
    value: TUpstream
) => TValue;

export class ComputedVal<TValue, TUpstream = TValue, TMeta = void> extends Val<
    TValue,
    TMeta
> {
    private _disposer: ValDisposer;

    public constructor(
        val: Val<TUpstream, TMeta>,
        transform: ComputedValTransform<TValue, TUpstream>,
        compare?: ValCompare<TValue>
    ) {
        super(transform(val.value), compare);
        this._disposer = val.reaction((value, meta) => {
            super.setValue(transform(value), meta);
        });
    }

    public destroy(): void {
        this._disposer();
        super.destroy();
    }
}
