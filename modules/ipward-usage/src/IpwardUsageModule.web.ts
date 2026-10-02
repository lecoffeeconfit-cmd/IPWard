import { registerWebModule, NativeModule } from 'expo';

// IpwardUsageModule is not available on the web platform.
class IpwardUsageModule extends NativeModule<{}> {}

export default registerWebModule(IpwardUsageModule, 'IpwardUsageModule');
