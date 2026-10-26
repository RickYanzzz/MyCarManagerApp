//
//  DCUTSProxy.h
//  libWeex
//
//  Created by Dcloud-XHY on 2022/8/16.
//  Copyright © 2022 DCloud. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <DCloudUTSFoundation/DCUniModel.h>

@class UTSCallback;
@class PTDeviceInfo;

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger,DCUTSBlockType){
    DCUTSBlockTypeParams,
    DCUTSBlockTypeReturn
};

typedef void (^DCUTSBlock)(id result, DCUTSBlockType type);

extern NSString *const kUTSCallbackId;
extern NSString *const kUTSWXCallback;
extern NSString *const kUTSWXCallbackName;

@interface DCUTSProxy : NSObject

+ (UTSCallback *)getUTSCallBackWithId:(NSInteger)callbackId;
+ (NSInvocation *)invocationWithTarget:(id)target selector:(SEL)selector arguments:(NSArray *)params argumentsType:(NSArray *)paramsType callback:(DCUTSBlock)cb;
+ (id)switchInvocationReture:(NSInvocation *)invocation;
+ (BOOL)isBaseObject:(id)obj;
+ (NSString *)utsJsonObjectToString:(id)obj;
+ (BOOL)isClassKindOfUTSJSONObject:(Class)aClass;
+ (NSString *)originTypeFromNumber:(NSNumber *)data;
+ (PTDeviceInfo *)deviceInfo;
+ (void)commitLogMessage:(NSString *)msg flag:(NSString *)flag;

@end

NS_ASSUME_NONNULL_END
