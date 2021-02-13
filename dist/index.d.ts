export declare function authorize(opts: createDexcomShareIterator.AuthorizeOptions): Promise<string>;
declare function createDexcomShareIterator(config: Partial<createDexcomShareIterator.IteratorOptions>): createDexcomShareIterator.DexcomShareIterator;
declare namespace createDexcomShareIterator {
    interface AuthorizeOptions {
        applicationId?: string;
        username?: string;
        accountName?: string;
        password?: string;
    }
    interface GetLatestReadingsOptions {
        sessionID: string;
        minutes?: number;
        maxCount?: number;
    }
    interface ReadOptions {
        sessionID?: string;
        minutes?: number;
        maxCount?: number;
    }
    interface IteratorOptions extends AuthorizeOptions {
        minTimeout: number;
        maxTimeout: number;
        waitTime: number;
    }
    interface IteratorState {
        config: IteratorOptions;
        latestReading: null | Reading;
        sessionId: null | Promise<string>;
    }
    enum Trend {
        None = 0,
        DoubleUp = 1,
        SingleUp = 2,
        FortyFiveUp = 3,
        Flat = 4,
        FortyFiveDown = 5,
        SingleDown = 6,
        DoubleDown = 7,
        NotComputable = 8,
        OutOfRange = 9
    }
    interface Reading {
        DT: string;
        ST: string;
        Trend: Trend;
        Value: number;
        WT: string;
        Date: number;
    }
    interface DexcomShareIterator extends AsyncGenerator<Reading, void, unknown> {
        read(opts: ReadOptions): Promise<Reading[]>;
        wait(): Promise<number>;
        reset(): void;
    }
}
export default createDexcomShareIterator;
