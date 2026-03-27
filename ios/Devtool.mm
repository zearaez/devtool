#import "Devtool.h"
#import <UIKit/UIKit.h>

@implementation Devtool
- (NSNumber *)multiply:(double)a b:(double)b {
    NSNumber *result = @(a * b);

    return result;
}

- (void)setClipboardString:(NSString *)text
{
  UIPasteboard *pasteboard = [UIPasteboard generalPasteboard];
  pasteboard.string = text ?: @"";
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeDevtoolSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"Devtool";
}

@end
