export type ValCompare<TValue> = (
    newValue: TValue,
    oldValue: TValue
) => boolean;

export type ValSubscriber<TValue, TMeta> = (
    value: TValue,
    meta?: TMeta
) => void;

export type ValDisposer = () => void;

export class Val<TValue, TMeta = any> {
    protected _value: TValue;

    public constructor(value: TValue, compare?: ValCompare<TValue>) {
        this._value = value;
        if (typeof compare === "function") {
            this.compare = compare;
        }
    }

    public get value(): TValue {
        return this._value;
    }

    public setValue(value: TValue, meta?: TMeta): void {
        if (!this.compare(value, this._value)) {
            this._value = value;
            if (this._subscribers) {
                this._subscribers.forEach((subscriber) =>
                    subscriber(value, meta)
                );
            }
        }
    }

    public reaction(subscriber: ValSubscriber<TValue, TMeta>): ValDisposer {
        if (!this._subscribers) {
            this._subscribers = new Set();
        }

        this._subscribers.add(subscriber);

        return (): void => {
            if (this._subscribers) {
                this._subscribers.delete(subscriber);
            }
        };
    }

    /** reaction + immediate emission */
    public subscribe(
        subscriber: ValSubscriber<TValue, TMeta>,
        meta?: TMeta
    ): ValDisposer {
        const disposer = this.reaction(subscriber);
        subscriber(this._value, meta);
        return disposer;
    }

    public destroy(): void {
        if (this._subscribers) {
            this._subscribers.clear();
        }
    }

    public compare(newValue: TValue, oldValue: TValue): boolean {
        return newValue === oldValue;
    }

    protected _subscribers?: Set<ValSubscriber<TValue, TMeta>>;
}
